import { Router } from 'express';
import Guest from '../models/Guest.js';
import Payment from '../models/Payment.js';
import Reservation from '../models/Reservation.js';
import HousekeepingTask from '../models/HousekeepingTask.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import { ROLES, RES_STATUSES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { asyncHandler, ok } from '../utils/errors.js';
import { today, todayStr, addDays, dayStr, withBalance, round } from '../utils/helpers.js';
import { getSettings } from '../services/settingsService.js';
import { roomStates } from '../services/occupancyService.js';
import { collectedSeries, occupancyByDay, outstandingTotal } from '../services/reportService.js';

const router = Router();
router.use(protect);
const POP = [{ path: 'guest', select: 'fullName phone' }, { path: 'rooms.room', select: 'number' }];

router.get('/notifications', asyncHandler(async (req, res) => {
  const s = await getSettings(); const t = today(s.timezone);
  const mine = req.user.role === ROLES.HOUSEKEEPING ? { assignedTo: req.user._id } : {};
  const [arrivals, departures, tasks, maintenance] = await Promise.all([
    req.user.role === ROLES.HOUSEKEEPING ? 0 : Reservation.countDocuments({ status: { $in: ['pending', 'confirmed'] }, checkIn: { $lte: t }, checkOut: { $gt: t } }),
    req.user.role === ROLES.HOUSEKEEPING ? 0 : Reservation.countDocuments({ status: 'checked_in', checkOut: { $lte: t } }),
    HousekeepingTask.countDocuments({ ...mine, status: { $in: ['pending', 'in_progress', 'needs_inspection'] } }),
    MaintenanceRequest.countDocuments({ ...(req.user.role === ROLES.HOUSEKEEPING ? mine : {}), status: { $in: ['open', 'in_progress'] } }),
  ]);
  ok(res, { arrivals, departures, tasks, maintenance });
}));

const allowed = authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION, ROLES.ACCOUNTANT);

router.get('/summary', allowed, asyncHandler(async (req, res) => {
  const s = await getSettings(); const tz = s.timezone;
  const t = today(tz); const tStr = todayStr(tz); const monthStart = `${tStr.slice(0, 8)}01`;
  const horizon = addDays(t, 14);

  const [todayIn, todayOut, active, upcoming, guests, statusAgg, outstanding, monthly, recentRes, recentPay, arrivals, departures] = await Promise.all([
    Reservation.countDocuments({ checkIn: t, status: { $in: ['pending', 'confirmed', 'checked_in'] } }),
    Reservation.countDocuments({ checkOut: t, status: { $in: ['checked_in', 'checked_out'] } }),
    Reservation.countDocuments({ status: 'checked_in' }),
    Reservation.countDocuments({ status: { $in: ['pending', 'confirmed'] }, checkIn: { $gt: t } }),
    Guest.countDocuments({ active: true }),
    Reservation.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    outstandingTotal(),
    collectedSeries(dayStr(addDays(new Date(`${monthStart}T00:00:00Z`), 0)), tStr, 'day', tz),
    Reservation.find().sort('-createdAt').limit(6).populate(POP).lean(),
    Payment.find().sort('-paidAt').limit(6).populate([{ path: 'guest', select: 'fullName' }, { path: 'reservation', select: 'reference' }]).lean(),
    Reservation.find({ status: { $in: ['pending', 'confirmed'] }, checkIn: { $gte: t, $lte: horizon } }).sort('checkIn').limit(8).populate(POP).lean(),
    Reservation.find({ status: 'checked_in', checkOut: { $lte: horizon } }).sort('checkOut').limit(8).populate(POP).lean(),
  ]);

  const states = await roomStates(req.query.date ? String(req.query.date) : undefined);
  const rooms = states.counts;
  ok(res, {
    date: states.date,
    rooms,
    occupancyRate: rooms.total ? round((rooms.occupied / rooms.total) * 100) : 0,
    cancelledReservations: statusAgg.find((x) => x._id === 'cancelled')?.n || 0,
    todayCheckIns: todayIn, todayCheckOuts: todayOut, activeReservations: active, upcomingReservations: upcoming, totalGuests: guests,
    revenueToday: round(monthly.find((m) => m.period === tStr)?.collected || 0),
    revenueMonth: round(monthly.reduce((a, m) => a + m.collected, 0)),
    outstandingPayments: outstanding.total, outstandingCount: outstanding.count,
    reservationsByStatus: RES_STATUSES.map((st) => ({ status: st, count: statusAgg.find((x) => x._id === st)?.n || 0 })),
    recentReservations: recentRes.map(withBalance), recentPayments: recentPay,
    upcomingArrivals: arrivals, upcomingDepartures: departures,
  });
}));

router.get('/revenue', allowed, asyncHandler(async (req, res) => {
  const s = await getSettings(); const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  const to = todayStr(s.timezone); const from = dayStr(addDays(new Date(`${to}T00:00:00Z`), -(days - 1)));
  const rows = await collectedSeries(from, to, 'day', s.timezone);
  const map = new Map(rows.map((r) => [r.period, r.collected]));
  const out = [];
  for (let i = 0; i < days; i += 1) { const d = dayStr(addDays(new Date(`${from}T00:00:00Z`), i)); out.push({ date: d, revenue: map.get(d) || 0 }); }
  ok(res, out);
}));

router.get('/occupancy', allowed, asyncHandler(async (req, res) => {
  const s = await getSettings(); const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const from = dayStr(addDays(today(s.timezone), -(days - 1)));
  ok(res, await occupancyByDay(from, todayStr(s.timezone)));
}));
export default router;
