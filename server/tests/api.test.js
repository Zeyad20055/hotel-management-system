import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { boot, iso } from './helpers.js';

let h; let admin; let rec; let acc; let hk; let sup;
const room = (n, extra = {}) => ({ number: n, type: 'double', floor: 1, capacity: 2, beds: 1, pricePerNight: 1000, ...extra });
const guest = (n, extra = {}) => ({ fullName: `Guest ${n}`, phone: `0100000${n}00`, idType: 'passport', idNumber: `ID${n}${n}${n}${n}`, ...extra });
let R1; let R2; let R3; let G1; let G2;

beforeAll(async () => {
  h = await boot('hotel_test_api');
  [sup, admin, rec, acc, hk] = await Promise.all(['super_admin', 'admin', 'receptionist', 'accountant', 'housekeeping'].map(h.as));
}, 180000);
afterAll(async () => { await h?.shutdown(); });

describe('health & authentication', () => {
  it('reports health with database state', async () => {
    const r = await h.anon().get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.database.state).toBe('connected');
  });
  it('rejects unauthenticated access', async () => { expect((await h.anon().get('/api/rooms')).status).toBe(401); });
  it('rejects bad credentials with a generic message', async () => {
    const r = await h.anon().post('/api/auth/login').send({ email: 'rec@t.io', password: 'wrong-password' });
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Invalid email or password');
  });
  it('never exposes password hashes', async () => {
    const me = await rec.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toMatch(/password"|\$2[aby]\$/);
  });
  it('changes password and validates strength', async () => {
    expect((await rec.post('/api/auth/change-password').send({ currentPassword: 'Passw0rd!x', newPassword: 'short' })).status).toBe(400);
    expect((await rec.post('/api/auth/change-password').send({ currentPassword: 'nope', newPassword: 'Newpass123' })).status).toBe(400);
    expect((await rec.post('/api/auth/change-password').send({ currentPassword: 'Passw0rd!x', newPassword: 'Newpass123' })).status).toBe(200);
    expect((await h.anon().post('/api/auth/login').send({ email: 'rec@t.io', password: 'Newpass123' })).status).toBe(200);
  });
  it('logs out by clearing the cookie', async () => {
    const a = await h.as('accountant');
    expect((await a.post('/api/auth/logout')).status).toBe(200);
    expect((await a.get('/api/auth/me')).status).toBe(401);
  });
});

describe('authorization', () => {
  it('blocks staff from actions outside their role', async () => {
    expect((await rec.post('/api/rooms').send(room('X1'))).status).toBe(403);
    expect((await acc.post('/api/reservations').send({})).status).toBe(403);
    expect((await hk.get('/api/payments')).status).toBe(403);
    expect((await hk.get('/api/guests')).status).toBe(403);
    expect((await rec.post('/api/users').send({ name: 'Eve', email: 'e@t.io', password: 'Passw0rd1', role: 'admin' })).status).toBe(403);
    expect((await rec.get('/api/reports/revenue')).status).toBe(403);
  });
  it('stops admins from creating Super Admins', async () => {
    expect((await admin.post('/api/users').send({ name: 'Eve', email: 'e@t.io', password: 'Passw0rd1', role: 'super_admin' })).status).toBe(403);
    const ok = await sup.post('/api/users').send({ name: 'Eve', email: 'e2@t.io', password: 'Passw0rd1', role: 'receptionist' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.mustChangePassword).toBe(true);
  });
  it('forces a password change before other API use', async () => {
    const u = h.anon();
    const login = await u.post('/api/auth/login').send({ email: 'e2@t.io', password: 'Passw0rd1' });
    const cookie = login.headers['set-cookie'];
    const r = await h.anon().get('/api/rooms').set('Cookie', cookie);
    expect(r.status).toBe(403);
    expect(r.body.details.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('rooms CRUD', () => {
  it('creates, validates and enforces unique numbers', async () => {
    const a = await admin.post('/api/rooms').send(room('101'));
    expect(a.status).toBe(201);
    R1 = a.body.data._id;
    expect((await admin.post('/api/rooms').send(room('101'))).status).toBe(409);
    expect((await admin.post('/api/rooms').send(room('102', { pricePerNight: -5 }))).status).toBe(400);
    expect((await admin.post('/api/rooms').send(room('102', { type: 'castle' }))).status).toBe(400);
    R2 = (await admin.post('/api/rooms').send(room('102', { type: 'suite', floor: 2, pricePerNight: 3000, capacity: 4 }))).body.data._id;
    R3 = (await admin.post('/api/rooms').send(room('103', { floor: 2, pricePerNight: 500, capacity: 1 }))).body.data._id;
  });
  it('searches, filters, sorts and paginates', async () => {
    expect((await rec.get('/api/rooms?search=102')).body.data).toHaveLength(1);
    expect((await rec.get('/api/rooms?floor=2')).body.data).toHaveLength(2);
    expect((await rec.get('/api/rooms?type=suite')).body.data).toHaveLength(1);
    expect((await rec.get('/api/rooms?minPrice=800&maxPrice=1500')).body.data).toHaveLength(1);
    const sorted = await rec.get('/api/rooms?sort=-pricePerNight&limit=2');
    expect(sorted.body.data.map((r) => r.number)).toEqual(['102', '101']);
    expect(sorted.body.meta).toMatchObject({ total: 3, pages: 2 });
  });
  it('updates and returns details', async () => {
    const u = await admin.patch(`/api/rooms/${R3}`).send({ description: 'Quiet', pricePerNight: 550 });
    expect(u.body.data.pricePerNight).toBe(550);
    expect((await admin.patch(`/api/rooms/${R3}`).send({ status: 'occupied' })).status).toBe(409);
    expect((await rec.get(`/api/rooms/${R3}`)).body.data.description).toBe('Quiet');
    expect((await rec.get('/api/rooms/not-an-id')).status).toBe(400);
  });
  it('deletes only when safe', async () => {
    const tmp = (await admin.post('/api/rooms').send(room('999'))).body.data._id;
    expect((await admin.delete(`/api/rooms/${tmp}`)).status).toBe(200);
    expect((await admin.get(`/api/rooms/${tmp}`)).status).toBe(404);
  });
});

describe('guests CRUD', () => {
  it('creates, rejects duplicates and validates', async () => {
    const a = await rec.post('/api/guests').send(guest(1));
    expect(a.status).toBe(201); G1 = a.body.data._id;
    expect((await rec.post('/api/guests').send(guest(1, { fullName: 'Someone Else', phone: '999999' }))).status).toBe(409); // same ID number
    expect((await rec.post('/api/guests').send(guest(1, { idNumber: 'OTHER-1' }))).status).toBe(409); // same name + phone
    expect((await rec.post('/api/guests').send({ fullName: 'A' })).status).toBe(400);
    G2 = (await rec.post('/api/guests').send(guest(2))).body.data._id;
  });
  it('masks ID numbers in lists, searches, and edits', async () => {
    const list = await rec.get('/api/guests?search=Guest 1');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].idNumber).toMatch(/^\*+1111$/);
    expect((await rec.get(`/api/guests/${G1}`)).body.data.idNumber).toBe('ID1111');
    expect((await acc.get(`/api/guests/${G1}`)).body.data.idNumber).toMatch(/^\*+/);
    expect((await rec.get('/api/guests?search=ID2222')).body.data).toHaveLength(1);
    expect((await rec.patch(`/api/guests/${G1}`).send({ notes: 'VIP' })).body.data.notes).toBe('VIP');
  });
});

describe('reservations: pricing and double-booking prevention', () => {
  let resA;
  it('quotes the price on the server (14% tax default)', async () => {
    const q = await rec.post('/api/reservations/quote').send({ checkIn: iso(1), checkOut: iso(3), adults: 2, roomIds: [R1] });
    expect(q.status).toBe(200);
    expect(q.body.data).toMatchObject({ nights: 2, roomTotal: 2000, subtotal: 2000, tax: 280, total: 2280 });
  });
  it('rejects invalid ranges and past dates', async () => {
    const base = { guestId: G1, adults: 1, roomIds: [R1] };
    expect((await rec.post('/api/reservations').send({ ...base, checkIn: iso(3), checkOut: iso(3) })).status).toBe(400);
    expect((await rec.post('/api/reservations').send({ ...base, checkIn: iso(5), checkOut: iso(2) })).status).toBe(400);
    expect((await rec.post('/api/reservations').send({ ...base, checkIn: iso(-2), checkOut: iso(1) })).status).toBe(400);
    expect((await rec.post('/api/reservations').send({ ...base, checkIn: '2026-02-30', checkOut: iso(1) })).status).toBe(400);
    expect((await rec.post('/api/reservations').send({ ...base, adults: 5, checkIn: iso(1), checkOut: iso(2) })).status).toBe(400); // capacity
  });
  it('creates a reservation ignoring any client-supplied totals', async () => {
    const r = await rec.post('/api/reservations').send({ guestId: G1, checkIn: iso(1), checkOut: iso(4), adults: 2, roomIds: [R1], total: 1, subtotal: 1, status: 'checked_in', confirm: true });
    expect(r.status).toBe(201);
    resA = r.body.data;
    expect(resA).toMatchObject({ status: 'confirmed', nights: 3, total: 3420, balance: 3420 });
    expect(resA.reference).toMatch(/^RSV-\d{8}-[A-F0-9]{5}$/);
  });
  it('blocks overlapping bookings but allows back-to-back stays', async () => {
    const mk = (a, b, rooms = [R1]) => rec.post('/api/reservations').send({ guestId: G2, checkIn: iso(a), checkOut: iso(b), adults: 1, roomIds: rooms });
    expect((await mk(2, 5)).status).toBe(409);   // overlaps inside
    expect((await mk(0, 2)).status).toBe(409);   // overlaps start
    expect((await mk(3, 6)).status).toBe(409);   // overlaps end
    expect((await mk(0, 8)).status).toBe(409);   // fully contains
    expect((await mk(4, 6)).status).toBe(201);   // starts on the checkout day -> allowed
    expect((await mk(-0, 1)).status).toBe(201);  // ends on the check-in day -> allowed
    expect((await mk(2, 5, [R2])).status).toBe(201); // other room is free
  });
  it('lets only one of many concurrent requests take the same room', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => rec.post('/api/reservations').send({ guestId: G2, checkIn: iso(20), checkOut: iso(22), adults: 1, roomIds: [R3] })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
  });
  it('frees the room after cancellation and re-validates on confirm', async () => {
    const p = await rec.post('/api/reservations').send({ guestId: G2, checkIn: iso(30), checkOut: iso(32), adults: 1, roomIds: [R2] });
    expect(p.body.data.status).toBe('pending');
    const dup = await rec.post('/api/reservations').send({ guestId: G1, checkIn: iso(31), checkOut: iso(33), adults: 1, roomIds: [R2] });
    expect(dup.status).toBe(409);
    expect((await rec.post(`/api/reservations/${p.body.data._id}/cancel`).send({ reason: 'changed plans' })).body.data.status).toBe('cancelled');
    expect((await rec.post(`/api/reservations/${p.body.data._id}/confirm`)).status).toBe(409);
    expect((await rec.post('/api/reservations').send({ guestId: G1, checkIn: iso(31), checkOut: iso(33), adults: 1, roomIds: [R2] })).status).toBe(201);
  });
  it('never offers maintenance rooms', async () => {
    const m = await admin.post('/api/maintenance').send({ roomId: R3, title: 'Leaking pipe' });
    expect(m.status).toBe(201);
    expect((await rec.post('/api/reservations').send({ guestId: G1, checkIn: iso(40), checkOut: iso(41), adults: 1, roomIds: [R3] })).status).toBe(409);
    const av = await rec.get(`/api/rooms/availability?checkIn=${iso(40)}&checkOut=${iso(41)}`);
    expect(av.body.data.map((r) => r.number)).not.toContain('103');
    await admin.patch(`/api/maintenance/${m.body.data._id}`).send({ status: 'completed' });
    expect((await rec.get(`/api/rooms/${R3}`)).body.data.status).toBe('cleaning');
  });
  it('only lets authorised roles grant discounts', async () => {
    const body = { guestId: G2, checkIn: iso(50), checkOut: iso(51), adults: 1, roomIds: [R1] };
    expect((await rec.post('/api/reservations').send({ ...body, discount: 500 })).status).toBe(403); // 50% > 10%
    const small = await rec.post('/api/reservations').send({ ...body, discount: 100 });
    expect(small.status).toBe(201);
    expect(small.body.data).toMatchObject({ discount: 100, total: 1026 });
    expect((await admin.post('/api/reservations').send({ ...body, checkIn: iso(60), checkOut: iso(61), discount: 500 })).status).toBe(201);
  });
  it('lists, searches and filters reservations', async () => {
    expect((await rec.get(`/api/reservations?search=${resA.reference}`)).body.data).toHaveLength(1);
    expect((await rec.get('/api/reservations?search=Guest 1')).body.data.length).toBeGreaterThan(0);
    expect((await rec.get('/api/reservations?status=cancelled')).body.data.every((r) => r.status === 'cancelled')).toBe(true);
  });
  it('deletes no room that has history', async () => {
    expect((await admin.delete(`/api/rooms/${R1}`)).status).toBe(409);
  });
});

describe('check-in, payments and check-out', () => {
  let svcId; let rid; let payId;
  it('creates services and adds charges to the bill', async () => {
    svcId = (await admin.post('/api/services').send({ name: 'Laundry', price: 100 })).body.data._id;
    expect((await rec.post('/api/services').send({ name: 'x', price: 1 })).status).toBe(403);
    const r = await rec.post('/api/reservations').send({ guestId: G1, checkIn: iso(0), checkOut: iso(2), adults: 2, roomIds: [R2], services: [{ serviceId: svcId, quantity: 2 }], confirm: false });
    rid = r.body.data._id;
    expect(r.body.data).toMatchObject({ servicesTotal: 200, roomTotal: 6000, total: 7068 }); // (6000+200) * 1.14
  });
  it('refuses check-in before confirmation, then checks in', async () => {
    expect((await rec.post(`/api/reservations/${rid}/check-in`).send({})).status).toBe(409);
    expect((await rec.post(`/api/reservations/${rid}/confirm`)).status).toBe(200);
    const ci = await rec.post(`/api/reservations/${rid}/check-in`).send({ deposit: { amount: 2000, method: 'cash', idempotencyKey: 'dep-1' } });
    expect(ci.status).toBe(200);
    expect(ci.body.data).toMatchObject({ status: 'checked_in', paid: 2000 });
    expect(ci.body.data.checkedInAt).toBeTruthy();
    expect((await rec.get(`/api/rooms/${R2}`)).body.data.currentStatus).toBe('occupied');
    expect((await rec.post(`/api/reservations/${rid}/check-in`).send({})).status).toBe(409);
    expect((await rec.post(`/api/reservations/${rid}/cancel`).send({})).status).toBe(409);
  });
  it('computes balances; rejects overpayment; ignores duplicate submissions', async () => {
    const p1 = await rec.post('/api/payments').send({ reservationId: rid, amount: 1000, method: 'card', idempotencyKey: 'k-1' });
    expect(p1.status).toBe(201); payId = p1.body.data._id;
    const dup = await rec.post('/api/payments').send({ reservationId: rid, amount: 1000, method: 'card', idempotencyKey: 'k-1' });
    expect(dup.status).toBe(200); expect(dup.body.data.duplicate).toBe(true);
    expect((await rec.post('/api/payments').send({ reservationId: rid, amount: 99999, method: 'cash' })).status).toBe(409);
    expect((await rec.post('/api/payments').send({ reservationId: rid, amount: 10, method: 'bitcoin' })).status).toBe(400);
    const r = await rec.get(`/api/reservations/${rid}`);
    expect(r.body.data).toMatchObject({ paid: 3000, balance: 4068 });
    expect(r.body.data.payments).toHaveLength(2);
  });
  it('blocks check-out with an unsettled balance, then settles', async () => {
    const blocked = await rec.post(`/api/reservations/${rid}/check-out`).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.details.balance).toBe(4068);
    expect((await acc.post('/api/payments').send({ reservationId: rid, amount: 4068, method: 'bank_transfer' })).status).toBe(201);
    expect((await rec.get(`/api/reservations/${rid}`)).body.data.balance).toBe(0);
  });
  it('checks out once, flags the room for cleaning and blocks repeat check-outs', async () => {
    const co = await rec.post(`/api/reservations/${rid}/check-out`).send({});
    expect(co.status).toBe(200);
    expect(co.body.data.status).toBe('checked_out');
    expect((await rec.post(`/api/reservations/${rid}/check-out`).send({})).status).toBe(409);
    const roomNow = (await rec.get(`/api/rooms/${R2}`)).body.data;
    expect(roomNow).toMatchObject({ status: 'cleaning', housekeepingStatus: 'dirty' });
    expect((await rec.post('/api/payments').send({ reservationId: rid, amount: 1, method: 'cash' })).status).toBe(409); // fully paid
  });
  it('records history of check-in/out operations', async () => {
    const h2 = await rec.get('/api/audit');
    const actions = h2.body.data.map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['reservation.check_in', 'reservation.check_out']));
    expect(actions.every((a) => a.startsWith('reservation.check'))).toBe(true);
  });
  it('lets housekeeping finish the cleaning task so the room is available again', async () => {
    const tasks = await admin.get(`/api/housekeeping?room=${R2}`);
    expect(tasks.body.data).toHaveLength(1);
    const t = tasks.body.data[0];
    const hkUser = h.users.housekeeping;
    expect((await admin.patch(`/api/housekeeping/${t._id}`).send({ assignedTo: String(hkUser._id) })).status).toBe(200);
    expect((await hk.get('/api/housekeeping')).body.data).toHaveLength(1);
    expect((await hk.patch(`/api/housekeeping/${t._id}`).send({ status: 'in_progress' })).status).toBe(200);
    expect((await hk.patch(`/api/housekeeping/${t._id}`).send({ status: 'done' })).status).toBe(403);
    expect((await admin.patch(`/api/housekeeping/${t._id}`).send({ status: 'done' })).status).toBe(200);
    expect((await rec.get(`/api/rooms/${R2}`)).body.data).toMatchObject({ status: 'available', housekeepingStatus: 'clean' });
  });
  it('refunds with authorisation and keeps an audit trail', async () => {
    expect((await rec.post(`/api/payments/${payId}/refund`).send({ amount: 100, reason: 'goodwill' })).status).toBe(403);
    const r = await acc.post(`/api/payments/${payId}/refund`).send({ amount: 400, reason: 'Service complaint' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'partially_refunded', refundedAmount: 400 });
    expect((await acc.post(`/api/payments/${payId}/refund`).send({ amount: 700, reason: 'too much' })).status).toBe(409);
    expect((await admin.get(`/api/reservations/${rid}`)).body.data).toMatchObject({ paid: 6668, balance: 400 });
    const full = await acc.post(`/api/payments/${payId}/refund`).send({ amount: 600, reason: 'Rest' });
    expect(full.body.data.status).toBe('refunded');
    const log = await admin.get('/api/audit?action=payment.refund');
    expect(log.body.data).toHaveLength(2);
  });
  it('filters payments', async () => {
    expect((await acc.get('/api/payments?method=card')).body.data).toHaveLength(1);
    expect((await acc.get(`/api/payments?reservation=${rid}`)).body.data.length).toBe(3);
    expect((await acc.get(`/api/payments?from=${iso(0)}&to=${iso(0)}`)).body.data.length).toBe(3);
  });
});

describe('dashboard & reports use database data', () => {
  it('summarises rooms, revenue and outstanding balances', async () => {
    const s = (await admin.get('/api/dashboard/summary')).body.data;
    expect(s.rooms.total).toBe(3);
    expect(s.revenueToday).toBe(6068); // collected net of refunds, not booked revenue
    expect(s.outstandingPayments).toBeGreaterThan(0);
    expect(s.totalGuests).toBe(2);
  });
  it('separates collected from booked revenue and exports CSV', async () => {
    const r = await acc.get(`/api/reports/revenue?from=${iso(-1)}&to=${iso(70)}&group=month`);
    expect(r.status).toBe(200);
    expect(r.body.data.summary.collected).toBe(6068);
    expect(r.body.data.summary.booked).toBeGreaterThan(r.body.data.summary.collected);
    expect(r.body.data.services[0]).toMatchObject({ name: 'Laundry', quantity: 2, revenue: 200 });
    const csv = await acc.get(`/api/reports/revenue?from=${iso(-1)}&to=${iso(70)}&format=csv`);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('collected');
    expect((await acc.get('/api/reports/occupancy')).status).toBe(200);
    expect((await acc.get('/api/reports/reservations')).body.data.summary.total).toBeGreaterThan(0);
    expect((await acc.get('/api/reports/payments')).body.data.byMethod.length).toBeGreaterThan(0);
    expect((await acc.get('/api/reports/revenue?from=2026-05-02&to=2026-05-01')).status).toBe(400);
  });
});

describe('availability by date, occupancy states, filters', () => {
  let a; let b; let g;
  it('computes room states per date: future bookings are never "occupied"', async () => {
    a = (await admin.post('/api/rooms').send(room('201', { capacity: 2 }))).body.data._id;
    b = (await admin.post('/api/rooms').send(room('202', { capacity: 2 }))).body.data._id;
    g = (await rec.post('/api/guests').send(guest(7))).body.data._id;
    const mk = (i, o, rooms) => rec.post('/api/reservations').send({ guestId: g, checkIn: iso(i), checkOut: iso(o), adults: 1, roomIds: rooms, confirm: true });
    const cur = await mk(0, 3, [a]); const fut = await mk(5, 8, [b]);
    expect(cur.status).toBe(201); expect(fut.status).toBe(201);
    await rec.post(`/api/reservations/${cur.body.data._id}/check-in`).send({});
    const find = (d, n) => d.rooms.find((r) => r.number === n);
    const today = (await rec.get('/api/rooms/occupancy')).body.data;
    expect(find(today, '201').state).toBe('occupied');
    expect(find(today, '202').state).toBe('available');        // future booking does not block today
    const mid = (await rec.get(`/api/rooms/occupancy?date=${iso(6)}`)).body.data;
    expect(find(mid, '202')).toMatchObject({ state: 'reserved' });
    expect(find(mid, '201').state).toBe('available');           // checkout day exclusive
    const out = (await rec.get(`/api/rooms/occupancy?date=${iso(3)}`)).body.data;
    expect(find(out, '201').state).toBe('available');
    expect((await rec.get('/api/rooms/occupancy?date=2026-13-40')).status).toBe(400);
  });
  it('filters availability by dates, guests and price', async () => {
    const q = (s) => rec.get(`/api/rooms/availability?checkIn=${iso(5)}&checkOut=${iso(8)}${s}`).then((r) => r.body.data.map((x) => x.number));
    expect(await q('')).not.toContain('202');
    expect(await q('&minPrice=2500')).toEqual(['102']);
    expect(await q('&guests=3')).toEqual(['102']);
    expect(await q('&type=suite')).toEqual(['102']);
  });
  it('lists reservation views, date ranges and payment status', async () => {
    const up = await rec.get('/api/reservations?view=upcoming'); expect(up.body.data.every((r) => ['pending', 'confirmed'].includes(r.status))).toBe(true);
    expect((await rec.get('/api/reservations?view=current')).body.data.every((r) => r.status === 'checked_in')).toBe(true);
    expect((await rec.get('/api/reservations?view=bogus')).status).toBe(400);
    expect((await rec.get(`/api/reservations?checkInFrom=${iso(5)}&checkInTo=${iso(5)}`)).body.data.length).toBeGreaterThan(0);
    const all = (await rec.get('/api/reservations?limit=100')).body.data;
    expect(all.every((r) => ['unpaid', 'partial', 'paid', 'none', 'refund_due'].includes(r.paymentStatus))).toBe(true);
    expect(all.find((r) => r.status === 'cancelled')?.paymentStatus).toBe('none');
  });
  it('reports cancelled reservations and date-aware dashboard counts', async () => {
    const s = (await admin.get(`/api/dashboard/summary?date=${iso(6)}`)).body.data;
    expect(s.cancelledReservations).toBeGreaterThan(0);
    expect(s.rooms.reserved).toBeGreaterThan(0);
    expect(s.rooms.total).toBe(5);
  });
  it('stores a manual transaction reference on payments', async () => {
    const r = await rec.post('/api/reservations').send({ guestId: g, checkIn: iso(80), checkOut: iso(81), adults: 1, roomIds: [a] });
    const p = await acc.post('/api/payments').send({ reservationId: r.body.data._id, amount: 500, method: 'bank_transfer', transactionRef: 'TRX-9981' });
    expect(p.body.data.transactionRef).toBe('TRX-9981');
    expect((await rec.get(`/api/reservations/${r.body.data._id}`)).body.data.paymentStatus).toBe('partial');
  });
});
