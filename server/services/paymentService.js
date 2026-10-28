import crypto from 'crypto';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Reservation from '../models/Reservation.js';
import { COUNTED_PAY } from '../models/constants.js';
import { HttpError } from '../utils/errors.js';
import { round, dayStr } from '../utils/helpers.js';
import { getSettings, paymentMethods } from './settingsService.js';
import { audit } from '../utils/audit.js';

const rand = () => crypto.randomBytes(4).toString('hex').slice(0, 5).toUpperCase();
export async function newReference(prefix, Model) {
  for (;;) {
    const ref = `${prefix}-${dayStr(new Date()).replace(/-/g, '')}-${rand()}`;
    if (!(await Model.exists({ reference: ref }))) return ref;
  }
}

/** Recompute the reservation's net collected amount from its payment records (single source of truth). */
export async function refreshPaid(reservationId) {
  const id = new mongoose.Types.ObjectId(String(reservationId));
  const agg = await Payment.aggregate([
    { $match: { reservation: id, status: { $in: COUNTED_PAY } } },
    { $group: { _id: null, net: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } },
  ]);
  const paid = round(agg[0]?.net || 0);
  await Reservation.updateOne({ _id: id }, { $set: { paid } });
  return paid;
}

/** NOT locked: callers wrap in withLock (check-in already holds it). */
export async function recordPayment(data, user) {
  const settings = await getSettings();
  const method = String(data.method).toLowerCase().trim().replace(/\s+/g, '_');
  if (!paymentMethods(settings).includes(method)) throw new HttpError(400, `Unsupported payment method: ${data.method}`);

  if (data.idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey: data.idempotencyKey });
    if (existing) return { payment: existing, duplicate: true };
  }
  const res = await Reservation.findById(data.reservationId);
  if (!res) throw new HttpError(404, 'Reservation not found');
  if (['cancelled', 'no_show'].includes(res.status)) throw new HttpError(409, 'Payments cannot be recorded on a cancelled or no-show reservation');

  const status = data.status || 'completed';
  if (status === 'completed') {
    const balance = round(res.total - res.paid);
    if (data.amount > balance + 0.009) throw new HttpError(409, `Amount exceeds the outstanding balance (${balance.toFixed(2)})`, { balance });
  }
  const payment = await Payment.create({
    reference: await newReference('PAY', Payment),
    reservation: res._id, guest: res.guest, amount: round(data.amount), method, status,
    kind: data.kind || 'payment', transactionRef: data.transactionRef || '', notes: data.notes || '', recordedBy: user._id,
    idempotencyKey: data.idempotencyKey || undefined,
  });
  const paid = await refreshPaid(res._id);
  await audit(user, 'payment.record', 'Payment', payment._id, { reference: payment.reference, amount: payment.amount, reservation: res.reference, status });
  return { payment, duplicate: false, paid, balance: round(res.total - paid) };
}

export async function refundPayment(id, { amount, reason }, user) {
  const p = await Payment.findById(id);
  if (!p) throw new HttpError(404, 'Payment not found');
  if (!['completed', 'partially_refunded'].includes(p.status)) throw new HttpError(409, 'Only completed payments can be refunded');
  const remaining = round(p.amount - p.refundedAmount);
  if (amount > remaining + 0.009) throw new HttpError(409, `Refund exceeds the refundable amount (${remaining.toFixed(2)})`, { remaining });
  p.refundedAmount = round(p.refundedAmount + amount);
  p.refunds.push({ amount: round(amount), reason, by: user._id });
  p.status = p.refundedAmount >= p.amount - 0.009 ? 'refunded' : 'partially_refunded';
  await p.save();
  await refreshPaid(p.reservation);
  await audit(user, 'payment.refund', 'Payment', p._id, { reference: p.reference, amount, reason });
  return p;
}
