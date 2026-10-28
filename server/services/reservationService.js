import crypto from 'crypto';
import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import Guest from '../models/Guest.js';
import Service from '../models/Service.js';
import HousekeepingTask from '../models/HousekeepingTask.js';
import { ROLES } from '../models/constants.js';
import { HttpError } from '../utils/errors.js';
import { parseDay, today, dayStr, nightsBetween, round, withLock } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';
import { getSettings } from './settingsService.js';
import { busyRoomIds } from './availabilityService.js';
import { computeTotals } from './pricing.js';
import { createGuest } from './guestService.js';
import { recordPayment } from './paymentService.js';

const rand = () => crypto.randomBytes(4).toString('hex').slice(0, 5).toUpperCase();
async function newReference() {
  for (;;) {
    const ref = `RSV-${dayStr(new Date()).replace(/-/g, '')}-${rand()}`;
    if (!(await Reservation.exists({ reference: ref }))) return ref;
  }
}

async function assertBookable(rooms, checkIn, checkOut, excludeId) {
  const maint = rooms.filter((r) => r.status === 'maintenance');
  if (maint.length) throw new HttpError(409, `Room ${maint.map((r) => r.number).join(', ')} is under maintenance and cannot be booked`);
  const busy = await busyRoomIds(checkIn, checkOut, excludeId);
  const clash = rooms.filter((r) => busy.has(String(r._id)));
  if (clash.length) throw new HttpError(409, `Room ${clash.map((r) => r.number).join(', ')} is already booked for the selected dates`, { rooms: clash.map((r) => r.number) });
}

function authorizeDiscount(user, discount, subtotal, settings) {
  if (!(discount > 0)) return;
  if ([ROLES.SUPER, ROLES.ADMIN].includes(user.role)) return;
  if (user.role === ROLES.RECEPTION) {
    const pct = subtotal > 0 ? (discount / subtotal) * 100 : 100;
    if (pct <= settings.maxReceptionistDiscountPercent + 1e-9) return;
    throw new HttpError(403, `Receptionists may grant discounts up to ${settings.maxReceptionistDiscountPercent}%. Ask an administrator to approve a larger discount.`);
  }
  throw new HttpError(403, 'You are not authorised to apply discounts');
}

async function buildCharges(items, user) {
  const out = [];
  for (const it of items || []) {
    const s = await Service.findById(it.serviceId);
    if (!s || !s.active) throw new HttpError(400, 'A selected service does not exist or is inactive');
    out.push({ service: s._id, name: s.name, quantity: it.quantity, unitPrice: s.price, total: round(s.price * it.quantity), addedBy: user._id });
  }
  return out;
}

/** Validates everything on the server and computes the authoritative price. Never trusts client totals. */
async function prepare(d, user, { excludeId, existing, requireFuture = true } = {}) {
  const settings = await getSettings();
  const checkIn = parseDay(d.checkIn);
  const checkOut = parseDay(d.checkOut);
  if (!(checkIn < checkOut)) throw new HttpError(400, 'Check-out must be after check-in');
  if (requireFuture && checkIn < today(settings.timezone)) throw new HttpError(400, 'Check-in date cannot be in the past');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > 365) throw new HttpError(400, 'A stay cannot exceed 365 nights');

  const ids = [...new Set(d.roomIds.map(String))];
  const roomDocs = await Room.find({ _id: { $in: ids } });
  if (roomDocs.length !== ids.length) throw new HttpError(404, 'One or more rooms were not found');
  await assertBookable(roomDocs, checkIn, checkOut, excludeId);
  const guests = d.adults + d.children;
  const capacity = roomDocs.reduce((s, r) => s + r.capacity, 0);
  if (guests > capacity) throw new HttpError(400, `Selected rooms sleep ${capacity} but ${guests} guests were specified`);

  const oldRate = new Map((existing?.rooms || []).map((r) => [String(r.room), r.rate]));
  const roomLines = roomDocs.map((r) => ({ room: r._id, rate: oldRate.get(String(r._id)) ?? r.pricePerNight }));
  const charges = existing ? existing.charges.map((c) => c.toObject()) : await buildCharges(d.services, user);
  const taxRate = existing?.taxRate ?? settings.taxRate;
  const totals = computeTotals({ nights, rooms: roomLines, charges, discount: d.discount, taxRate });
  if (round(d.discount || 0) !== round(existing?.discount || 0)) authorizeDiscount(user, d.discount, totals.subtotal, settings);
  return { settings, checkIn, checkOut, nights, roomLines, roomDocs, charges, totals, taxRate };
}

export async function quoteReservation(d, user) {
  const p = await prepare({ ...d, services: d.services || [], discount: d.discount || 0 }, user);
  return { nights: p.nights, taxRate: p.taxRate, rooms: p.roomDocs.map((r) => ({ id: r._id, number: r.number, type: r.type, rate: r.pricePerNight, subtotal: round(r.pricePerNight * p.nights) })), charges: p.charges, ...p.totals };
}

export const createReservation = (d, user) => withLock(async () => {
  const p = await prepare(d, user);
  let guestId = d.guestId;
  if (guestId) {
    const g = await Guest.findById(guestId);
    if (!g) throw new HttpError(404, 'Guest not found');
    if (!g.active) throw new HttpError(409, 'This guest record is deactivated');
  } else guestId = (await createGuest(d.guest))._id;

  const res = await Reservation.create({
    reference: await newReference(), guest: guestId, rooms: p.roomLines, checkIn: p.checkIn, checkOut: p.checkOut, nights: p.nights,
    adults: d.adults, children: d.children, status: d.confirm ? 'confirmed' : 'pending', charges: p.charges, taxRate: p.taxRate,
    ...p.totals, discountBy: p.totals.discount > 0 ? user._id : undefined, notes: d.notes, createdBy: user._id,
  });
  await audit(user, 'reservation.create', 'Reservation', res._id, { reference: res.reference, total: res.total });
  return res;
});

export const updateReservation = (id, patch, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (!['pending', 'confirmed'].includes(res.status)) throw new HttpError(409, `A ${res.status.replace('_', '-')} reservation cannot be edited`);
  const merged = {
    checkIn: patch.checkIn ?? dayStr(res.checkIn), checkOut: patch.checkOut ?? dayStr(res.checkOut),
    adults: patch.adults ?? res.adults, children: patch.children ?? res.children,
    roomIds: patch.roomIds ?? res.rooms.map((r) => String(r.room)), discount: patch.discount ?? res.discount,
  };
  const datesChanged = merged.checkIn !== dayStr(res.checkIn);
  const p = await prepare(merged, user, { excludeId: res._id, existing: res, requireFuture: datesChanged });
  if (patch.guestId) {
    const g = await Guest.findById(patch.guestId);
    if (!g || !g.active) throw new HttpError(404, 'Guest not found or inactive');
    res.guest = g._id;
  }
  res.set({ rooms: p.roomLines, checkIn: p.checkIn, checkOut: p.checkOut, nights: p.nights, adults: merged.adults, children: merged.children, ...p.totals, notes: patch.notes ?? res.notes });
  if (p.totals.discount > 0 && round(res.discount) !== round(p.totals.discount)) res.discountBy = user._id;
  await res.save();
  await audit(user, 'reservation.update', 'Reservation', res._id, { reference: res.reference, total: res.total });
  return res;
});

export const confirmReservation = (id, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (res.status !== 'pending') throw new HttpError(409, 'Only pending reservations can be confirmed');
  const settings = await getSettings();
  if (res.checkOut <= today(settings.timezone)) throw new HttpError(409, 'This reservation is already in the past');
  const rooms = await Room.find({ _id: { $in: res.rooms.map((r) => r.room) } });
  await assertBookable(rooms, res.checkIn, res.checkOut, res._id); // re-check availability at confirmation
  res.status = 'confirmed';
  await res.save();
  await audit(user, 'reservation.confirm', 'Reservation', res._id, { reference: res.reference });
  return res;
});

export const cancelReservation = (id, reason, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (!['pending', 'confirmed'].includes(res.status)) throw new HttpError(409, `A ${res.status.replace('_', '-')} reservation cannot be cancelled`);
  res.status = 'cancelled'; res.cancelReason = reason; res.cancelledAt = new Date();
  await res.save();
  await audit(user, 'reservation.cancel', 'Reservation', res._id, { reference: res.reference, reason, paid: res.paid });
  return res;
});

export const markNoShow = (id, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (!['pending', 'confirmed'].includes(res.status)) throw new HttpError(409, 'Only pending or confirmed reservations can be marked as no-show');
  const settings = await getSettings();
  if (res.checkIn > today(settings.timezone)) throw new HttpError(409, 'The arrival date has not been reached yet');
  res.status = 'no_show';
  await res.save();
  await audit(user, 'reservation.no_show', 'Reservation', res._id, { reference: res.reference });
  return res;
});

function recalc(res) {
  Object.assign(res, computeTotals({ nights: res.nights, rooms: res.rooms.map((r) => ({ rate: r.rate })), charges: res.charges, discount: res.discount, taxRate: res.taxRate }));
}

export const addCharge = (id, { serviceId, quantity }, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (!['pending', 'confirmed', 'checked_in'].includes(res.status)) throw new HttpError(409, 'Charges can only be added to open reservations');
  const [charge] = await buildCharges([{ serviceId, quantity }], user);
  res.charges.push(charge);
  recalc(res);
  await res.save();
  await audit(user, 'reservation.add_charge', 'Reservation', res._id, { reference: res.reference, service: charge.name, total: charge.total });
  return res;
});

export const removeCharge = (id, chargeId, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (!['pending', 'confirmed', 'checked_in'].includes(res.status)) throw new HttpError(409, 'The bill is closed');
  const c = res.charges.id(chargeId);
  if (!c) throw new HttpError(404, 'Charge not found');
  c.deleteOne();
  recalc(res);
  await res.save();
  await audit(user, 'reservation.remove_charge', 'Reservation', res._id, { reference: res.reference, service: c.name });
  return res;
});

export const checkIn = (id, body, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (res.status === 'pending') throw new HttpError(409, 'Confirm the reservation before checking in');
  if (res.status !== 'confirmed') throw new HttpError(409, `Cannot check in a ${res.status.replace('_', '-')} reservation`);
  const settings = await getSettings();
  const t = today(settings.timezone);
  if (t < res.checkIn) throw new HttpError(409, `Too early: arrival date is ${dayStr(res.checkIn)}`);
  if (t >= res.checkOut) throw new HttpError(409, 'The stay period has already ended');
  const roomIds = res.rooms.map((r) => r.room);
  const rooms = await Room.find({ _id: { $in: roomIds } });
  const blocked = rooms.filter((r) => ['occupied', 'cleaning', 'maintenance'].includes(r.status));
  if (blocked.length) throw new HttpError(409, `Room ${blocked.map((r) => `${r.number} (${r.status})`).join(', ')} is not ready for check-in`);
  res.status = 'checked_in'; res.checkedInAt = new Date(); res.checkedInBy = user._id;
  await res.save();
  await Room.updateMany({ _id: { $in: roomIds } }, { status: 'occupied', housekeepingStatus: 'clean' });
  let payment;
  if (body.deposit) {
    const r = await recordPayment({ reservationId: res._id, kind: 'deposit', ...body.deposit }, user);
    payment = r.payment;
  }
  await audit(user, 'reservation.check_in', 'Reservation', res._id, { reference: res.reference, rooms: rooms.map((r) => r.number), deposit: payment?.amount });
  return { reservation: await Reservation.findById(res._id), payment };
});

export const checkOut = (id, body, user) => withLock(async () => {
  const res = await Reservation.findById(id);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (res.status !== 'checked_in') throw new HttpError(409, res.status === 'checked_out' ? 'This reservation has already been checked out' : 'Only checked-in reservations can be checked out');
  const balance = round(res.total - res.paid);
  if (balance > 0.009 && !body.allowOutstanding) throw new HttpError(409, `Outstanding balance of ${balance.toFixed(2)} must be settled (or explicitly recorded as outstanding)`, { balance, code: 'OUTSTANDING_BALANCE' });
  const roomIds = res.rooms.map((r) => r.room);
  res.status = 'checked_out'; res.checkedOutAt = new Date(); res.checkedOutBy = user._id; res.outstandingAtCheckout = Math.max(0, balance);
  await res.save();
  await Room.updateMany({ _id: { $in: roomIds } }, { status: 'cleaning', housekeepingStatus: 'dirty' });
  await HousekeepingTask.insertMany(roomIds.map((room) => ({ room, type: 'cleaning', status: 'pending', reservation: res._id, createdBy: user._id, notes: `Check-out ${res.reference}` })));
  await audit(user, 'reservation.check_out', 'Reservation', res._id, { reference: res.reference, total: res.total, paid: res.paid, outstanding: Math.max(0, balance), notes: body.notes });
  return res;
});
