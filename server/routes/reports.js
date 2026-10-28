import { Router } from 'express';
import Reservation from '../models/Reservation.js';
import Payment from '../models/Payment.js';
import Guest from '../models/Guest.js';
import { ROLES, COUNTED_PAY } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { parseDay, todayStr, addDays, dayStr, round, toCsv, zonedStart, nightsBetween } from '../utils/helpers.js';
import { getSettings } from '../services/settingsService.js';
import { BILLABLE, OCCUPYING, collectedSeries, bookedSeries, occupancyByDay, outstandingTotal } from '../services/reportService.js';

const router = Router();
router.use(protect, authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.ACCOUNTANT));

async function range(req) {
  const s = await getSettings();
  const to = req.query.to ? dayStr(parseDay(String(req.query.to))) : todayStr(s.timezone);
  const from = req.query.from ? dayStr(parseDay(String(req.query.from))) : dayStr(addDays(new Date(`${to}T00:00:00Z`), -29));
  if (from > to) throw new HttpError(400, 'The start date must not be after the end date');
  if (nightsBetween(new Date(from), new Date(to)) > 3700) throw new HttpError(400, 'Date range too large');
  const unit = ['day', 'month', 'year'].includes(req.query.group) ? req.query.group : 'day';
  return { tz: s.timezone, from, to, unit, fromDate: new Date(`${from}T00:00:00Z`), toDate: new Date(`${to}T00:00:00Z`), start: zonedStart(from, s.timezone), endEx: zonedStart(dayStr(addDays(new Date(`${to}T00:00:00Z`), 1)), s.timezone) };
}
function send(req, res, name, payload, rows) {
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}-${todayStr()}.csv"`);
    return res.send(toCsv(rows));
  }
  return ok(res, payload);
}

router.get('/revenue', asyncHandler(async (req, res) => {
  const r = await range(req);
  const [collected, booked, services, refunds] = await Promise.all([
    collectedSeries(r.from, r.to, r.unit, r.tz), bookedSeries(r.from, r.to, r.unit),
    Reservation.aggregate([
      { $match: { status: { $in: BILLABLE }, checkIn: { $gte: r.fromDate, $lte: r.toDate } } }, { $unwind: '$charges' },
      { $group: { _id: '$charges.name', quantity: { $sum: '$charges.quantity' }, revenue: { $sum: '$charges.total' } } }, { $sort: { revenue: -1 } },
    ]),
    Payment.aggregate([{ $match: { paidAt: { $gte: r.start, $lt: r.endEx }, refundedAmount: { $gt: 0 } } }, { $group: { _id: null, n: { $sum: '$refundedAmount' } } }]),
  ]);
  const periods = [...new Set([...collected.map((c) => c.period), ...booked.map((b) => b.period)])].sort();
  const series = periods.map((p) => ({ period: p, collected: collected.find((c) => c.period === p)?.collected || 0, booked: booked.find((b) => b.period === p)?.booked || 0 }));
  const outstanding = await outstandingTotal();
  const summary = {
    collected: round(collected.reduce((a, c) => a + c.collected, 0)), booked: round(booked.reduce((a, b) => a + b.booked, 0)),
    servicesRevenue: round(services.reduce((a, s) => a + s.revenue, 0)), refunded: round(refunds[0]?.n || 0), outstanding: outstanding.total,
  };
  send(req, res, 'revenue', { range: { from: r.from, to: r.to, group: r.unit }, summary, series, services: services.map((s) => ({ name: s._id, quantity: s.quantity, revenue: round(s.revenue) })) },
    series.map((x) => ({ period: x.period, collected: x.collected, booked_revenue: x.booked })));
}));

router.get('/occupancy', asyncHandler(async (req, res) => {
  const r = await range(req);
  const series = await occupancyByDay(r.from, r.to);
  const sold = series.reduce((a, d) => a + d.occupiedRooms, 0); const cap = series.reduce((a, d) => a + d.totalRooms, 0);
  const rs = await Reservation.find({ status: { $in: OCCUPYING }, checkIn: { $lte: r.toDate }, checkOut: { $gt: r.fromDate } }).populate('rooms.room', 'number type').lean();
  const perRoom = new Map();
  for (const x of rs) {
    const n = Math.max(0, nightsBetween(x.checkIn > r.fromDate ? x.checkIn : r.fromDate, x.checkOut < addDays(r.toDate, 1) ? x.checkOut : addDays(r.toDate, 1)));
    for (const line of x.rooms) {
      if (!line.room) continue;
      const k = String(line.room._id); const cur = perRoom.get(k) || { room: line.room.number, type: line.room.type, nights: 0, revenue: 0 };
      cur.nights += n; cur.revenue = round(cur.revenue + n * line.rate); perRoom.set(k, cur);
    }
  }
  const days = series.length;
  const rooms = [...perRoom.values()].map((x) => ({ ...x, occupancyRate: round((x.nights / days) * 100) })).sort((a, b) => b.revenue - a.revenue);
  send(req, res, 'occupancy', { range: { from: r.from, to: r.to }, summary: { averageOccupancy: cap ? round((sold / cap) * 100) : 0, roomNightsSold: sold, roomNightsAvailable: cap, adr: sold ? round(rooms.reduce((a, x) => a + x.revenue, 0) / sold) : 0 }, series, rooms },
    rooms.length ? rooms : series);
}));

router.get('/reservations', asyncHandler(async (req, res) => {
  const r = await range(req);
  const f = { checkIn: { $gte: r.fromDate, $lte: r.toDate } };
  const [list, checkIns, checkOuts] = await Promise.all([
    Reservation.find(f).sort('checkIn').populate('guest', 'fullName').populate('rooms.room', 'number').lean(),
    Reservation.find({ checkedInAt: { $gte: r.start, $lt: r.endEx } }).sort('checkedInAt').populate('guest', 'fullName').select('reference guest checkedInAt').lean(),
    Reservation.find({ checkedOutAt: { $gte: r.start, $lt: r.endEx } }).sort('checkedOutAt').populate('guest', 'fullName').select('reference guest checkedOutAt total paid').lean(),
  ]);
  const byStatus = {}; list.forEach((x) => { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
  const cancelled = (byStatus.cancelled || 0) + (byStatus.no_show || 0);
  send(req, res, 'reservations', {
    range: { from: r.from, to: r.to },
    summary: { total: list.length, byStatus, cancellationRate: list.length ? round(((byStatus.cancelled || 0) / list.length) * 100) : 0, noShowRate: list.length ? round(((byStatus.no_show || 0) / list.length) * 100) : 0, lost: cancelled, checkIns: checkIns.length, checkOuts: checkOuts.length },
    checkIns, checkOuts,
  }, list.map((x) => ({ reference: x.reference, guest: x.guest?.fullName, rooms: x.rooms.map((l) => l.room?.number).join(' '), check_in: dayStr(x.checkIn), check_out: dayStr(x.checkOut), nights: x.nights, status: x.status, total: x.total, paid: x.paid, balance: round(x.total - x.paid) })));
}));

router.get('/payments', asyncHandler(async (req, res) => {
  const r = await range(req);
  const [byMethod, byStatus, outstanding, list] = await Promise.all([
    Payment.aggregate([{ $match: { paidAt: { $gte: r.start, $lt: r.endEx }, status: { $in: COUNTED_PAY } } }, { $group: { _id: '$method', collected: { $sum: { $subtract: ['$amount', '$refundedAmount'] } }, gross: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { collected: -1 } }]),
    Payment.aggregate([{ $match: { paidAt: { $gte: r.start, $lt: r.endEx } } }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Reservation.find({ status: { $in: ['confirmed', 'checked_in', 'checked_out'] }, $expr: { $gt: [{ $subtract: ['$total', '$paid'] }, 0.009] } }).sort('-checkIn').limit(500).populate('guest', 'fullName phone').lean(),
    Payment.find({ paidAt: { $gte: r.start, $lt: r.endEx } }).sort('-paidAt').limit(2000).populate('guest', 'fullName').populate('reservation', 'reference').lean(),
  ]);
  send(req, res, 'payments', {
    range: { from: r.from, to: r.to },
    summary: { collected: round(byMethod.reduce((a, m) => a + m.collected, 0)), payments: byMethod.reduce((a, m) => a + m.count, 0), outstanding: round(outstanding.reduce((a, o) => a + (o.total - o.paid), 0)) },
    byMethod: byMethod.map((m) => ({ method: m._id, collected: round(m.collected), gross: round(m.gross), count: m.count })),
    byStatus: byStatus.map((s) => ({ status: s._id, amount: round(s.amount), count: s.count })),
    outstanding: outstanding.map((o) => ({ _id: o._id, reference: o.reference, guest: o.guest?.fullName, phone: o.guest?.phone, status: o.status, total: o.total, paid: o.paid, balance: round(o.total - o.paid) })),
  }, list.map((p) => ({ payment: p.reference, reservation: p.reservation?.reference, guest: p.guest?.fullName, method: p.method, status: p.status, amount: p.amount, refunded: p.refundedAmount, date: p.paidAt })));
}));

router.get('/guests', asyncHandler(async (req, res) => {
  const r = await range(req);
  const [total, fresh, nat, repeat] = await Promise.all([
    Guest.countDocuments(), Guest.countDocuments({ createdAt: { $gte: r.start, $lt: r.endEx } }),
    Guest.aggregate([{ $match: { nationality: { $ne: '' } } }, { $group: { _id: '$nationality', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }]),
    Reservation.aggregate([{ $match: { status: 'checked_out' } }, { $group: { _id: '$guest', stays: { $sum: 1 }, spent: { $sum: '$paid' } } }, { $match: { stays: { $gte: 2 } } }, { $sort: { spent: -1 } }, { $limit: 20 },
      { $lookup: { from: 'guests', localField: '_id', foreignField: '_id', as: 'g' } }, { $unwind: '$g' }, { $project: { name: '$g.fullName', stays: 1, spent: 1 } }]),
  ]);
  send(req, res, 'guests', { range: { from: r.from, to: r.to }, summary: { totalGuests: total, newGuests: fresh, repeatGuests: repeat.length }, nationalities: nat.map((x) => ({ nationality: x._id, guests: x.n })), repeatGuests: repeat.map((x) => ({ name: x.name, stays: x.stays, spent: round(x.spent) })) },
    repeat.map((x) => ({ guest: x.name, stays: x.stays, total_spent: round(x.spent) })));
}));
export default router;
