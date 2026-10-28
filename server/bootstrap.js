import User from './models/User.js';
import Room from './models/Room.js';
import Guest from './models/Guest.js';
import Service from './models/Service.js';
import Reservation from './models/Reservation.js';
import Payment from './models/Payment.js';
import MaintenanceRequest from './models/MaintenanceRequest.js';
import env from './config/env.js';
import { ROLES } from './models/constants.js';
import { getSettings } from './services/settingsService.js';
import { createReservation, confirmReservation, checkIn } from './services/reservationService.js';
import { refreshPaid } from './services/paymentService.js';
import { computeTotals } from './services/pricing.js';
import { addDays, dayStr, today, nightsBetween } from './utils/helpers.js';

/** Creates the first Super Admin when the users collection is empty. */
export async function ensureAdmin() {
  if ((await User.countDocuments()) > 0) return null;
  if (env.adminEmail && env.adminPassword) {
    const u = await User.create({ name: env.adminName, email: env.adminEmail, password: env.adminPassword, role: ROLES.SUPER, mustChangePassword: false });
    console.log(`[setup] Created the first Super Admin from ADMIN_EMAIL: ${u.email}`);
    return u;
  }
  if (env.isProd) throw new Error('No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first Super Admin.');
  const u = await User.create({ name: 'Demo Super Admin', email: 'admin@hotel.local', password: 'Admin@12345', role: ROLES.SUPER, mustChangePassword: true });
  console.log('[setup] Created DEVELOPMENT admin  ->  admin@hotel.local / Admin@12345  (you will be asked to change this password at first login)');
  return u;
}

const ROOM_PLAN = [['single', 800, 1, 1], ['double', 1200, 2, 1], ['twin', 1300, 2, 2], ['deluxe', 1800, 3, 1], ['family', 2200, 5, 3]];
const dateAt = (offset) => dayStr(addDays(new Date(`${dayStr(new Date())}T00:00:00Z`), offset));

export async function seedDemo({ force = false } = {}) {
  if (env.isProd) throw new Error('Demo data cannot be seeded in production.');
  if (!force && (await Room.countDocuments()) > 0) { console.log('[seed] Database already has rooms - skipping demo data (use FORCE to override).'); return false; }
  const settings = await getSettings();
  const admin = await User.findOne({ role: ROLES.SUPER });
  const staff = [['Rana Reception', 'reception@hotel.local', 'Recep@12345', ROLES.RECEPTION], ['Adel Accountant', 'accountant@hotel.local', 'Account@12345', ROLES.ACCOUNTANT], ['Hana Housekeeping', 'housekeeping@hotel.local', 'House@12345', ROLES.HOUSEKEEPING], ['Mona Manager', 'manager@hotel.local', 'Manager@12345', ROLES.ADMIN]];
  for (const [name, email, password, role] of staff) if (!(await User.exists({ email }))) await User.create({ name, email, password, role });

  const rooms = [];
  for (let floor = 1; floor <= 4; floor += 1) {
    for (let i = 1; i <= 5; i += 1) {
      const plan = floor === 4 && i >= 4 ? (i === 4 ? ['suite', 3000, 3, 2] : ['presidential_suite', 8000, 4, 2]) : ROOM_PLAN[i - 1];
      rooms.push({ number: `${floor}0${i}`, type: plan[0], floor, capacity: plan[2], beds: plan[3], pricePerNight: plan[1], amenities: ['Wi-Fi', 'Air conditioning', 'TV', ...(plan[1] >= 1800 ? ['Minibar', 'Sea view'] : [])], description: `${plan[0].replace('_', ' ')} room on floor ${floor}` });
    }
  }
  const roomDocs = await Room.insertMany(rooms);
  const R = (n) => roomDocs.find((r) => r.number === n);

  await Service.insertMany([['Restaurant', 'Breakfast, lunch & dinner', 250], ['Room service', 'In-room dining', 120], ['Laundry', 'Per bag', 90], ['Airport transfer', 'One way', 600], ['Spa', 'Spa session', 900], ['Minibar', 'Minibar consumption', 150], ['Extra bed', 'Per night', 300]].map(([name, description, price]) => ({ name, description, price })));
  const svc = await Service.find().lean();
  const guests = await Guest.insertMany([
    { fullName: 'Ahmed Hassan', phone: '+201001112233', email: 'ahmed@example.com', nationality: 'Egyptian', idType: 'national_id', idNumber: '29001011234567' },
    { fullName: 'Sara Mostafa', phone: '+201112223344', email: 'sara@example.com', nationality: 'Egyptian', idType: 'national_id', idNumber: '29203021234568' },
    { fullName: 'John Miller', phone: '+14155550101', email: 'john@example.com', nationality: 'American', idType: 'passport', idNumber: 'X1234567' },
    { fullName: 'Layla Al-Farsi', phone: '+971501234567', email: 'layla@example.com', nationality: 'Emirati', idType: 'passport', idNumber: 'P7654321' },
    { fullName: 'Marco Rossi', phone: '+393331234567', email: 'marco@example.com', nationality: 'Italian', idType: 'passport', idNumber: 'IT998877' },
    { fullName: 'Omar Khaled', phone: '+201223334455', nationality: 'Egyptian', idType: 'national_id', idNumber: '29506051234569' },
  ]);

  // Past, completed stays so charts / reports have data (inserted directly - they happened "before").
  const hist = [[-24, 2, '101', 0], [-20, 3, '203', 2], [-16, 2, '302', 1], [-12, 4, '401', 3], [-9, 2, '104', 4], [-6, 3, '202', 5], [-4, 2, '305', 0], [-3, 1, '103', 2]];
  let n = 0;
  for (const [off, nights, rn, gi] of hist) {
    n += 1;
    const room = R(rn); const ci = new Date(`${dateAt(off)}T00:00:00Z`); const co = addDays(ci, nights);
    const charges = n % 2 ? [{ service: svc[0]._id, name: svc[0].name, quantity: nights, unitPrice: svc[0].price, total: svc[0].price * nights }] : [];
    const totals = computeTotals({ nights, rooms: [{ rate: room.pricePerNight }], charges, discount: 0, taxRate: settings.taxRate });
    const r = await Reservation.create({ reference: `RSV-${dateAt(off).replace(/-/g, '')}-H000${n}`, guest: guests[gi]._id, rooms: [{ room: room._id, rate: room.pricePerNight }], checkIn: ci, checkOut: co, nights, adults: 1, status: 'checked_out', charges, taxRate: settings.taxRate, ...totals, checkedInAt: ci, checkedOutAt: co, outstandingAtCheckout: 0, createdBy: admin._id });
    const half = n % 3 === 0;
    await Payment.create({ reference: `PAY-${dateAt(off).replace(/-/g, '')}-H000${n}`, reservation: r._id, guest: guests[gi]._id, amount: half ? Math.round(totals.total / 2) : totals.total, method: ['cash', 'card', 'bank_transfer'][n % 3], paidAt: co, recordedBy: admin._id });
    await refreshPaid(r._id);
  }

  // Live data created through the real business logic.
  const t = dateAt(0);
  const a = await createReservation({ guestId: guests[0]._id, checkIn: t, checkOut: dateAt(3), adults: 2, children: 0, roomIds: [R('202')._id], services: [{ serviceId: svc[3]._id, quantity: 1 }], discount: 0, notes: 'Late arrival expected', confirm: true }, admin);
  const b = await createReservation({ guestId: guests[2]._id, checkIn: t, checkOut: dateAt(2), adults: 2, children: 1, roomIds: [R('204')._id], services: [], discount: 0, notes: '', confirm: true }, admin);
  await checkIn(b._id, { deposit: { amount: 1000, method: 'card', idempotencyKey: 'seed-deposit-1' } }, admin);
  await createReservation({ guestId: guests[1]._id, checkIn: dateAt(3), checkOut: dateAt(5), adults: 2, children: 0, roomIds: [R('203')._id], services: [], discount: 0, notes: '', confirm: true }, admin);
  await createReservation({ guestId: guests[3]._id, checkIn: dateAt(7), checkOut: dateAt(10), adults: 3, children: 0, roomIds: [R('404')._id], services: [{ serviceId: svc[4]._id, quantity: 2 }], discount: 0, notes: 'Anniversary', confirm: false }, admin);
  await createReservation({ guestId: guests[4]._id, checkIn: dateAt(1), checkOut: dateAt(4), adults: 2, children: 2, roomIds: [R('105')._id], services: [], discount: 0, notes: '', confirm: true }, admin);
  void a; void confirmReservation; void today; void nightsBetween;
  await Room.updateOne({ number: '305' }, { status: 'maintenance' });
  await MaintenanceRequest.create({ room: R('305')._id, title: 'Air-conditioning not cooling', description: 'Compressor check required', priority: 'high', status: 'in_progress', createdBy: admin._id });
  console.log('[seed] Demo data created: 20 rooms, 6 guests, 7 services, reservations, payments.');
  console.log('[seed] Demo logins: reception@hotel.local / Recep@12345, accountant@hotel.local / Account@12345, housekeeping@hotel.local / House@12345, manager@hotel.local / Manager@12345');
  return true;
}
