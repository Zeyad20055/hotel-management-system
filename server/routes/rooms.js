import { Router } from 'express';
import Room from '../models/Room.js';
import Reservation from '../models/Reservation.js';
import { ROLES, ACTIVE_RES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate, checkIdParam } from '../middlewares/common.js';
import { roomCreate, roomPatch } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { paginate, esc, parseDay, today, nightsBetween, withLock } from '../utils/helpers.js';
import { getSettings } from '../services/settingsService.js';
import { availableRooms } from '../services/availabilityService.js';
import { audit } from '../utils/audit.js';
import { roomStates } from '../services/occupancyService.js';

const router = Router();
router.param('id', checkIdParam);
router.use(protect);
const manage = authorize(ROLES.SUPER, ROLES.ADMIN);

/** Adds `currentStatus`: stored status, but "reserved" when a pending/confirmed booking covers today. */
async function withCurrentStatus(rooms) {
  const s = await getSettings();
  const t = today(s.timezone);
  const rs = await Reservation.find({ status: { $in: ['pending', 'confirmed'] }, checkIn: { $lte: t }, checkOut: { $gt: t } }).select('rooms.room').lean();
  const reserved = new Set(rs.flatMap((r) => r.rooms.map((x) => String(x.room))));
  return rooms.map((r) => ({ ...r, currentStatus: r.status === 'available' && reserved.has(String(r._id)) ? 'reserved' : r.status }));
}

router.get('/', asyncHandler(async (req, res) => {
  const q = req.query; const f = {};
  if (q.search) f.number = new RegExp(esc(q.search), 'i');
  if (q.floor !== undefined && q.floor !== '') f.floor = Number(q.floor);
  if (q.type) f.type = String(q.type);
  if (q.status && q.status !== 'reserved') f.status = String(q.status);
  if (q.minPrice || q.maxPrice) f.pricePerNight = { ...(q.minPrice ? { $gte: Number(q.minPrice) } : {}), ...(q.maxPrice ? { $lte: Number(q.maxPrice) } : {}) };
  const { data, meta } = await paginate(Room, f, req, { sortable: ['number', 'floor', 'pricePerNight', 'type', 'capacity', 'status'], defaultSort: 'number' });
  let rows = await withCurrentStatus(data);
  if (q.status === 'reserved') rows = rows.filter((r) => r.currentStatus === 'reserved');
  ok(res, rows, meta);
}));

router.get('/occupancy', asyncHandler(async (req, res) => ok(res, await roomStates(req.query.date ? String(req.query.date) : undefined))));

router.get('/availability', asyncHandler(async (req, res) => {
  const checkIn = parseDay(String(req.query.checkIn || '')); const checkOut = parseDay(String(req.query.checkOut || ''));
  if (!(checkIn < checkOut)) throw new HttpError(400, 'Check-out must be after check-in');
  const filter = {};
  if (req.query.type) filter.type = String(req.query.type);
  if (req.query.guests) filter.capacity = { $gte: Number(req.query.guests) };
  if (req.query.minPrice || req.query.maxPrice) filter.pricePerNight = { ...(req.query.minPrice ? { $gte: Number(req.query.minPrice) } : {}), ...(req.query.maxPrice ? { $lte: Number(req.query.maxPrice) } : {}) };
  const rooms = await availableRooms(checkIn, checkOut, { filter, excludeId: req.query.excludeReservation });
  const nights = nightsBetween(checkIn, checkOut);
  ok(res, rooms.map((r) => ({ ...r, nights, stayTotal: Math.round(r.pricePerNight * nights * 100) / 100 })));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id).lean();
  if (!room) throw new HttpError(404, 'Room not found');
  const [withStatus] = await withCurrentStatus([room]);
  const reservations = req.user.role === ROLES.HOUSEKEEPING ? [] : await Reservation.find({ 'rooms.room': room._id, status: { $in: ACTIVE_RES }, checkOut: { $gte: new Date(Date.now() - 86400000) } })
    .sort('checkIn').limit(10).populate('guest', 'fullName').select('reference checkIn checkOut status guest').lean();
  ok(res, { ...withStatus, upcomingReservations: reservations });
}));

router.post('/', manage, validate(roomCreate), asyncHandler(async (req, res) => {
  const room = await Room.create(req.body);
  await audit(req.user, 'room.create', 'Room', room._id, { number: room.number });
  ok(res, room, undefined, 201);
}));

router.patch('/:id', manage, validate(roomPatch), asyncHandler(async (req, res) => withLock(async () => {
  const room = await Room.findById(req.params.id);
  if (!room) throw new HttpError(404, 'Room not found');
  const b = req.body;
  if (b.status && b.status !== room.status) {
    if (b.status === 'occupied') throw new HttpError(409, 'Rooms become occupied through guest check-in');
    if (room.status === 'occupied') throw new HttpError(409, 'The room is occupied; check the guest out first');
    if (b.status === 'maintenance') {
      const inHouse = await Reservation.exists({ 'rooms.room': room._id, status: 'checked_in' });
      if (inHouse) throw new HttpError(409, 'A guest is staying in this room');
    }
  }
  room.set(b);
  await room.save();
  await audit(req.user, 'room.update', 'Room', room._id, { number: room.number, fields: Object.keys(b) });
  ok(res, room);
})));

router.delete('/:id', manage, asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw new HttpError(404, 'Room not found');
  if (await Reservation.exists({ 'rooms.room': room._id, status: { $in: ACTIVE_RES } })) throw new HttpError(409, 'This room has active reservations and cannot be deleted');
  if (await Reservation.exists({ 'rooms.room': room._id })) throw new HttpError(409, 'This room has reservation history that must be preserved. Put it under maintenance instead of deleting it.');
  await room.deleteOne();
  await audit(req.user, 'room.delete', 'Room', room._id, { number: room.number });
  ok(res, { deleted: true });
}));
export default router;
