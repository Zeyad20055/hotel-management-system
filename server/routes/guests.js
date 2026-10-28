import { Router } from 'express';
import Guest from '../models/Guest.js';
import Reservation from '../models/Reservation.js';
import { ROLES, ACTIVE_RES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate, checkIdParam } from '../middlewares/common.js';
import { guestCreate, guestPatch } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { paginate, esc, round } from '../utils/helpers.js';
import { createGuest, updateGuest } from '../services/guestService.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.param('id', checkIdParam);
router.use(protect);
const read = authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION, ROLES.ACCOUNTANT);
const write = authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION);
const canSeeId = (u) => [ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION].includes(u.role);
const mask = (g) => (g.idNumber ? { ...g, idNumber: `${'*'.repeat(Math.max(0, g.idNumber.length - 4))}${g.idNumber.slice(-4)}` } : g);

router.get('/', read, asyncHandler(async (req, res) => {
  const f = {};
  if (req.query.active) f.active = req.query.active === 'true';
  if (req.query.search) { const r = new RegExp(esc(req.query.search), 'i'); f.$or = [{ fullName: r }, { phone: r }, { email: r }, { idNumber: r }]; }
  const { data, meta } = await paginate(Guest, f, req, { sortable: ['fullName', 'createdAt', 'nationality'], defaultSort: '-createdAt' });
  ok(res, data.map(mask), meta);
}));

router.get('/:id', read, asyncHandler(async (req, res) => {
  const g = await Guest.findById(req.params.id).lean();
  if (!g) throw new HttpError(404, 'Guest not found');
  const reservations = await Reservation.find({ guest: g._id }).sort('-checkIn').populate('rooms.room', 'number').lean();
  const live = reservations.filter((r) => !['cancelled', 'no_show'].includes(r.status));
  const stats = {
    totalStays: reservations.filter((r) => r.status === 'checked_out').length,
    totalReservations: reservations.length,
    totalSpending: round(live.reduce((s, r) => s + (r.paid || 0), 0)),
    outstandingBalance: round(live.filter((r) => r.status !== 'pending').reduce((s, r) => s + Math.max(0, r.total - r.paid), 0)),
  };
  ok(res, { ...(canSeeId(req.user) ? g : mask(g)), stats, reservations: reservations.map((r) => ({ _id: r._id, reference: r.reference, status: r.status, checkIn: r.checkIn, checkOut: r.checkOut, total: r.total, paid: r.paid, rooms: r.rooms.map((x) => x.room?.number) })) });
}));

router.post('/', write, validate(guestCreate), asyncHandler(async (req, res) => {
  const g = await createGuest(req.body);
  await audit(req.user, 'guest.create', 'Guest', g._id, { name: g.fullName });
  ok(res, g, undefined, 201);
}));

router.patch('/:id', write, validate(guestPatch), asyncHandler(async (req, res) => {
  const g = await updateGuest(req.params.id, req.body);
  await audit(req.user, 'guest.update', 'Guest', g._id, { fields: Object.keys(req.body) });
  ok(res, g);
}));

// Guests with reservation history are deactivated (history/accounting preserved); others are removed.
router.delete('/:id', authorize(ROLES.SUPER, ROLES.ADMIN), asyncHandler(async (req, res) => {
  const g = await Guest.findById(req.params.id);
  if (!g) throw new HttpError(404, 'Guest not found');
  if (await Reservation.exists({ guest: g._id, status: { $in: ACTIVE_RES } })) throw new HttpError(409, 'This guest has active reservations');
  if (await Reservation.exists({ guest: g._id })) {
    g.active = false; await g.save();
    await audit(req.user, 'guest.deactivate', 'Guest', g._id, { name: g.fullName });
    return ok(res, { deleted: false, deactivated: true });
  }
  await g.deleteOne();
  await audit(req.user, 'guest.delete', 'Guest', g._id, { name: g.fullName });
  ok(res, { deleted: true });
}));
export default router;
