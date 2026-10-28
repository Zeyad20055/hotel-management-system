import { Router } from 'express';
import Payment from '../models/Payment.js';
import Reservation from '../models/Reservation.js';
import Guest from '../models/Guest.js';
import { ROLES, PAY_STATUSES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate, checkIdParam } from '../middlewares/common.js';
import { paymentCreate, refundBody } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { paginate, esc, parseDay, addDays, dayStr, zonedStart, withLock, isId } from '../utils/helpers.js';
import { getSettings } from '../services/settingsService.js';
import { recordPayment, refundPayment } from '../services/paymentService.js';

const router = Router();
router.param('id', checkIdParam);
router.use(protect, authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.RECEPTION));
const POP = [{ path: 'reservation', select: 'reference total paid status' }, { path: 'guest', select: 'fullName phone' }, { path: 'recordedBy', select: 'name' }];

router.get('/', asyncHandler(async (req, res) => {
  const q = req.query; const f = {};
  if (q.status && PAY_STATUSES.includes(q.status)) f.status = q.status;
  if (q.method) f.method = String(q.method);
  if (q.reservation && isId(q.reservation)) f.reservation = q.reservation;
  if (q.guest && isId(q.guest)) f.guest = q.guest;
  if (q.from || q.to) {
    const tz = (await getSettings()).timezone;
    f.paidAt = { ...(q.from ? { $gte: zonedStart(dayStr(parseDay(String(q.from))), tz) } : {}), ...(q.to ? { $lt: zonedStart(dayStr(addDays(parseDay(String(q.to)), 1)), tz) } : {}) };
  }
  if (q.search) {
    const r = new RegExp(esc(q.search), 'i');
    const [gs, rs] = await Promise.all([Guest.find({ fullName: r }).select('_id').limit(200).lean(), Reservation.find({ reference: r }).select('_id').limit(200).lean()]);
    f.$or = [{ reference: r }, { guest: { $in: gs.map((g) => g._id) } }, { reservation: { $in: rs.map((x) => x._id) } }];
  }
  const { data, meta } = await paginate(Payment, f, req, { sortable: ['paidAt', 'amount', 'reference', 'status'], defaultSort: '-paidAt', populate: POP });
  ok(res, data, meta);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const p = await Payment.findById(req.params.id).populate(POP).lean();
  if (!p) throw new HttpError(404, 'Payment not found');
  ok(res, p);
}));

router.post('/', validate(paymentCreate), asyncHandler(async (req, res) => {
  const r = await withLock(() => recordPayment(req.body, req.user));
  const p = await Payment.findById(r.payment._id).populate(POP).lean();
  ok(res, { ...p, duplicate: r.duplicate }, undefined, r.duplicate ? 200 : 201);
}));

router.post('/:id/refund', authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.ACCOUNTANT), validate(refundBody), asyncHandler(async (req, res) => {
  const p = await withLock(() => refundPayment(req.params.id, req.body, req.user));
  ok(res, await Payment.findById(p._id).populate(POP).lean());
}));
export default router;
