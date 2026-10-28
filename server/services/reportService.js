import Payment from '../models/Payment.js';
import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import { COUNTED_PAY } from '../models/constants.js';
import { addDays, dayStr, nightsBetween, round, zonedStart } from '../utils/helpers.js';

const FORMATS = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };
const NET = { $subtract: ['$amount', '$refundedAmount'] };
export const BILLABLE = ['pending', 'confirmed', 'checked_in', 'checked_out'];
export const OCCUPYING = ['confirmed', 'checked_in', 'checked_out'];

/** Money actually collected (payments minus refunds), grouped by period in the hotel's time zone. */
export async function collectedSeries(fromStr, toStr, unit, tz) {
  const from = zonedStart(fromStr, tz); const to = zonedStart(dayStr(addDays(new Date(`${toStr}T00:00:00Z`), 1)), tz);
  const rows = await Payment.aggregate([
    { $match: { status: { $in: COUNTED_PAY }, paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: { $dateToString: { format: FORMATS[unit], date: '$paidAt', timezone: tz } }, collected: { $sum: NET }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ period: r._id, collected: round(r.collected), payments: r.count }));
}

/** Booked revenue (reservation totals, excluding cancelled / no-show) grouped by arrival date. */
export async function bookedSeries(fromStr, toStr, unit) {
  const rows = await Reservation.aggregate([
    { $match: { status: { $in: BILLABLE }, checkIn: { $gte: new Date(`${fromStr}T00:00:00Z`), $lte: new Date(`${toStr}T00:00:00Z`) } } },
    { $group: { _id: { $dateToString: { format: FORMATS[unit], date: '$checkIn' } }, booked: { $sum: '$total' }, reservations: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ period: r._id, booked: round(r.booked), reservations: r.reservations }));
}

/** Occupied room-nights per calendar day in [from, to] inclusive. */
export async function occupancyByDay(fromStr, toStr) {
  const from = new Date(`${fromStr}T00:00:00Z`); const toEx = addDays(new Date(`${toStr}T00:00:00Z`), 1);
  const [totalRooms, rs] = await Promise.all([
    Room.countDocuments(),
    Reservation.find({ status: { $in: OCCUPYING }, checkIn: { $lt: toEx }, checkOut: { $gt: from } }).select('checkIn checkOut rooms').lean(),
  ]);
  const days = nightsBetween(from, toEx);
  const occupied = new Array(days).fill(0);
  for (const r of rs) {
    const s = Math.max(0, nightsBetween(from, r.checkIn)); const e = Math.min(days, nightsBetween(from, r.checkOut));
    for (let i = s; i < e; i += 1) occupied[i] += r.rooms.length;
  }
  return occupied.map((n, i) => ({ date: dayStr(addDays(from, i)), occupiedRooms: Math.min(n, totalRooms), totalRooms, rate: totalRooms ? round((Math.min(n, totalRooms) / totalRooms) * 100) : 0 }));
}

export async function outstandingTotal() {
  const [r] = await Reservation.aggregate([
    { $match: { status: { $in: ['confirmed', 'checked_in', 'checked_out'] } } },
    { $addFields: { balance: { $subtract: ['$total', '$paid'] } } },
    { $match: { balance: { $gt: 0.009 } } },
    { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } },
  ]);
  return { total: round(r?.total || 0), count: r?.count || 0 };
}
