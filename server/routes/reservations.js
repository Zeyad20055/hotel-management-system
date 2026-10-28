import { Router } from 'express';
import Reservation from '../models/Reservation.js';
import Guest from '../models/Guest.js';
import Payment from '../models/Payment.js';
import { ROLES, RES_STATUSES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate, checkIdParam } from '../middlewares/common.js';
import { reservationCreate, reservationQuote, reservationPatch, checkInBody, checkOutBody, cancelBody, chargeBody } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { paginate, esc, parseDay, today, withBalance, isId, zonedStart, dayStr, addDays } from '../utils/helpers.js';
import { getSettings } from '../services/settingsService.js';
import * as svc from '../services/reservationService.js';

const router = Router();
router.param('id', checkIdParam);
router.param('chargeId', checkIdParam);
router.use(protect, authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION, ROLES.ACCOUNTANT));
const write = authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION);
const POP = [{ path: 'guest', select: 'fullName phone email nationality' }, { path: 'rooms.room', select: 'number type floor' }];

async function full(id) {
  const r = await Reservation.findById(id).populate(POP).lean();
  if (!r) throw new HttpError(404, 'Reservation not found');
  const payments = await Payment.find({ reservation: id }).sort('-paidAt').populate('recordedBy', 'name').lean();
  return { ...withBalance(r), payments };
}

router.get('/', asyncHandler(async (req, res) => {
  const q = req.query; const f = {};
  if (q.status) f.status = { $in: String(q.status).split(',').filter((s) => RES_STATUSES.includes(s)) };
  if (q.guest && isId(q.guest)) f.guest = q.guest;
  if (q.from) f.checkOut = { $gte: parseDay(String(q.from)) };            // stay overlaps [from, to]
  if (q.to) f.checkIn = { $lte: parseDay(String(q.to)) };
  const range = (field, a, b) => { if (a || b) f[field] = { ...(f[field] || {}), ...(a ? { $gte: parseDay(String(a)) } : {}), ...(b ? { $lte: parseDay(String(b)) } : {}) }; };
  range('checkIn', q.checkInFrom, q.checkInTo); range('checkOut', q.checkOutFrom, q.checkOutTo);
  if (q.createdFrom || q.createdTo) {
    const tz = (await getSettings()).timezone;
    f.createdAt = { ...(q.createdFrom ? { $gte: zonedStart(dayStr(parseDay(String(q.createdFrom))), tz) } : {}), ...(q.createdTo ? { $lt: zonedStart(dayStr(addDays(parseDay(String(q.createdTo)), 1)), tz) } : {}) };
  }
  if (q.view) {
    const t = today((await getSettings()).timezone);
    const views = { upcoming: { status: { $in: ['pending', 'confirmed'] }, checkIn: { $gt: t } }, current: { status: 'checked_in' }, completed: { status: 'checked_out' }, cancelled: { status: { $in: ['cancelled', 'no_show'] } } };
    if (!views[q.view]) throw new HttpError(400, 'Unknown view');
    Object.assign(f, views[q.view]);
  }
  if (q.search) {
    const r = new RegExp(esc(q.search), 'i');
    const gs = await Guest.find({ $or: [{ fullName: r }, { phone: r }] }).select('_id').limit(200).lean();
    f.$or = [{ reference: r }, { guest: { $in: gs.map((g) => g._id) } }];
  }
  const { data, meta } = await paginate(Reservation, f, req, { sortable: ['reference', 'checkIn', 'checkOut', 'total', 'status', 'createdAt'], defaultSort: '-createdAt', populate: POP });
  ok(res, data.map(withBalance), meta);
}));

router.post('/quote', write, validate(reservationQuote), asyncHandler(async (req, res) => ok(res, await svc.quoteReservation(req.body, req.user))));

// Arrivals expected today (plus overdue arrivals still waiting) and in-house guests.
router.get('/arrivals', asyncHandler(async (_req, res) => {
  const t = today((await getSettings()).timezone);
  const data = await Reservation.find({ status: { $in: ['pending', 'confirmed'] }, checkIn: { $lte: t }, checkOut: { $gt: t } }).sort('checkIn').populate(POP).lean();
  ok(res, data.map(withBalance));
}));
router.get('/in-house', asyncHandler(async (_req, res) => {
  const t = today((await getSettings()).timezone);
  const data = await Reservation.find({ status: 'checked_in' }).sort('checkOut').populate(POP).lean();
  ok(res, data.map((r) => ({ ...withBalance(r), departingToday: r.checkOut <= t })));
}));

router.get('/:id', asyncHandler(async (req, res) => ok(res, await full(req.params.id))));

router.post('/', write, validate(reservationCreate), asyncHandler(async (req, res) => {
  const r = await svc.createReservation(req.body, req.user);
  ok(res, await full(r._id), undefined, 201);
}));
router.patch('/:id', write, validate(reservationPatch), asyncHandler(async (req, res) => {
  await svc.updateReservation(req.params.id, req.body, req.user);
  ok(res, await full(req.params.id));
}));
router.post('/:id/confirm', write, asyncHandler(async (req, res) => { await svc.confirmReservation(req.params.id, req.user); ok(res, await full(req.params.id)); }));
router.post('/:id/cancel', write, validate(cancelBody), asyncHandler(async (req, res) => { await svc.cancelReservation(req.params.id, req.body.reason, req.user); ok(res, await full(req.params.id)); }));
router.post('/:id/no-show', write, asyncHandler(async (req, res) => { await svc.markNoShow(req.params.id, req.user); ok(res, await full(req.params.id)); }));
router.post('/:id/check-in', write, validate(checkInBody), asyncHandler(async (req, res) => { await svc.checkIn(req.params.id, req.body, req.user); ok(res, await full(req.params.id)); }));
router.post('/:id/check-out', write, validate(checkOutBody), asyncHandler(async (req, res) => { await svc.checkOut(req.params.id, req.body, req.user); ok(res, await full(req.params.id)); }));
router.post('/:id/charges', write, validate(chargeBody), asyncHandler(async (req, res) => { await svc.addCharge(req.params.id, req.body, req.user); ok(res, await full(req.params.id), undefined, 201); }));
router.delete('/:id/charges/:chargeId', write, asyncHandler(async (req, res) => { await svc.removeCharge(req.params.id, req.params.chargeId, req.user); ok(res, await full(req.params.id)); }));
export default router;
