import { Router } from 'express';
import HousekeepingTask from '../models/HousekeepingTask.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import { ROLES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate, checkIdParam } from '../middlewares/common.js';
import { taskCreate, taskPatch, maintCreate, maintPatch } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { paginate, isId } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';

export const housekeepingRouter = Router();
export const maintenanceRouter = Router();
housekeepingRouter.param('id', checkIdParam);
maintenanceRouter.param('id', checkIdParam);
housekeepingRouter.use(protect);
maintenanceRouter.use(protect);
const managers = [ROLES.SUPER, ROLES.ADMIN];
const TASK_POP = [{ path: 'room', select: 'number floor type status housekeepingStatus' }, { path: 'assignedTo', select: 'name' }];

const HK_FOR_TASK = { pending: 'dirty', in_progress: 'cleaning', needs_inspection: 'inspection', done: 'clean' };
async function applyTaskToRoom(task) {
  const room = await Room.findById(task.room);
  if (!room) return;
  room.housekeepingStatus = HK_FOR_TASK[task.status];
  if (task.status === 'done' && room.status === 'cleaning') room.status = 'available';
  await room.save();
}

housekeepingRouter.get('/', asyncHandler(async (req, res) => {
  const f = {};
  if (req.user.role === ROLES.HOUSEKEEPING) f.assignedTo = req.user._id; // staff only see their own assignments
  else if (req.query.assignedTo && isId(req.query.assignedTo)) f.assignedTo = req.query.assignedTo;
  if (req.query.status) f.status = String(req.query.status);
  if (req.query.room && isId(req.query.room)) f.room = req.query.room;
  const { data, meta } = await paginate(HousekeepingTask, f, req, { sortable: ['createdAt', 'status'], defaultSort: '-createdAt', populate: TASK_POP });
  ok(res, data, meta);
}));

// Room board: housekeeping state of every room (managers/reception only)
housekeepingRouter.get('/rooms', authorize(...managers, ROLES.RECEPTION), asyncHandler(async (_req, res) => {
  ok(res, await Room.find().sort('number').select('number floor type status housekeepingStatus').lean());
}));

housekeepingRouter.post('/', authorize(...managers, ROLES.RECEPTION), validate(taskCreate), asyncHandler(async (req, res) => {
  const room = await Room.findById(req.body.roomId);
  if (!room) throw new HttpError(404, 'Room not found');
  const t = await HousekeepingTask.create({ room: room._id, type: req.body.type, assignedTo: req.body.assignedTo || undefined, notes: req.body.notes, createdBy: req.user._id });
  await audit(req.user, 'housekeeping.create', 'HousekeepingTask', t._id, { room: room.number });
  ok(res, await HousekeepingTask.findById(t._id).populate(TASK_POP).lean(), undefined, 201);
}));

housekeepingRouter.patch('/:id', validate(taskPatch), asyncHandler(async (req, res) => {
  const t = await HousekeepingTask.findById(req.params.id);
  if (!t) throw new HttpError(404, 'Task not found');
  const isManager = [...managers, ROLES.RECEPTION].includes(req.user.role);
  if (!isManager && !(req.user.role === ROLES.HOUSEKEEPING && String(t.assignedTo) === String(req.user._id))) throw new HttpError(403, 'You can only update tasks assigned to you');
  if (!isManager && req.body.assignedTo !== undefined) throw new HttpError(403, 'Only managers can reassign tasks');
  if (req.body.status && !isManager && req.body.status === 'done') throw new HttpError(403, 'Mark the room as "needs inspection"; a supervisor completes it');
  if (req.body.assignedTo !== undefined) t.assignedTo = req.body.assignedTo || undefined;
  if (req.body.notes !== undefined) t.notes = req.body.notes;
  if (req.body.status && req.body.status !== t.status) {
    t.status = req.body.status;
    t.completedAt = t.status === 'done' ? new Date() : undefined;
    await applyTaskToRoom(t);
  }
  await t.save();
  await audit(req.user, 'housekeeping.update', 'HousekeepingTask', t._id, { status: t.status });
  ok(res, await HousekeepingTask.findById(t._id).populate(TASK_POP).lean());
}));

// ---------------- Maintenance ----------------
const M_POP = [{ path: 'room', select: 'number floor' }, { path: 'assignedTo', select: 'name' }, { path: 'createdBy', select: 'name' }];
maintenanceRouter.use(authorize(...managers, ROLES.RECEPTION, ROLES.HOUSEKEEPING));

maintenanceRouter.get('/', asyncHandler(async (req, res) => {
  const f = {};
  if (req.query.status) f.status = { $in: String(req.query.status).split(',') };
  if (req.query.room && isId(req.query.room)) f.room = req.query.room;
  const { data, meta } = await paginate(MaintenanceRequest, f, req, { sortable: ['createdAt', 'priority', 'status'], populate: M_POP });
  ok(res, data, meta);
}));

maintenanceRouter.post('/', validate(maintCreate), asyncHandler(async (req, res) => {
  const room = await Room.findById(req.body.roomId);
  if (!room) throw new HttpError(404, 'Room not found');
  if (req.body.blockRoom) {
    if (room.status === 'occupied' || (await Reservation.exists({ 'rooms.room': room._id, status: 'checked_in' }))) throw new HttpError(409, 'A guest is staying in this room. Create a non-blocking request, or check the guest out first.');
  }
  const { roomId, ...rest } = req.body;
  const m = await MaintenanceRequest.create({ ...rest, room: room._id, assignedTo: rest.assignedTo || undefined, createdBy: req.user._id });
  if (m.blockRoom) { room.status = 'maintenance'; await room.save(); }
  const upcoming = m.blockRoom ? await Reservation.countDocuments({ 'rooms.room': room._id, status: { $in: ['pending', 'confirmed'] }, checkOut: { $gt: new Date() } }) : 0;
  await audit(req.user, 'maintenance.create', 'MaintenanceRequest', m._id, { room: room.number, title: m.title });
  ok(res, { ...(await MaintenanceRequest.findById(m._id).populate(M_POP).lean()), upcomingReservationsAffected: upcoming }, undefined, 201);
}));

maintenanceRouter.patch('/:id', validate(maintPatch), asyncHandler(async (req, res) => {
  const m = await MaintenanceRequest.findById(req.params.id);
  if (!m) throw new HttpError(404, 'Request not found');
  const isManager = [...managers, ROLES.RECEPTION].includes(req.user.role);
  if (!isManager && String(m.assignedTo) !== String(req.user._id)) throw new HttpError(403, 'You can only update requests assigned to you');
  if (!isManager && (req.body.assignedTo !== undefined || req.body.priority)) throw new HttpError(403, 'Only managers can reassign or re-prioritise');
  const { status, assignedTo, ...rest } = req.body;
  m.set(rest);
  if (assignedTo !== undefined) m.assignedTo = assignedTo || undefined;
  if (status && status !== m.status) {
    m.status = status;
    m.completedAt = ['completed', 'cancelled'].includes(status) ? new Date() : undefined;
    if (['completed', 'cancelled'].includes(status) && m.blockRoom) {
      const others = await MaintenanceRequest.exists({ room: m.room, _id: { $ne: m._id }, blockRoom: true, status: { $in: ['open', 'in_progress'] } });
      if (!others) await Room.updateOne({ _id: m.room, status: 'maintenance' }, { status: 'cleaning', housekeepingStatus: 'dirty' }); // inspected/cleaned before returning to stock
    }
    if (['open', 'in_progress'].includes(status) && m.blockRoom) await Room.updateOne({ _id: m.room, status: { $ne: 'occupied' } }, { status: 'maintenance' });
  }
  await m.save();
  await audit(req.user, 'maintenance.update', 'MaintenanceRequest', m._id, { status: m.status });
  ok(res, await MaintenanceRequest.findById(m._id).populate(M_POP).lean());
}));
