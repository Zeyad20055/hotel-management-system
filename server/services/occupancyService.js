import Room from '../models/Room.js';
import Reservation from '../models/Reservation.js';
import { getSettings } from './settingsService.js';
import { parseDay, todayStr } from '../utils/helpers.js';

/**
 * State of every room on a calendar date D (check-in inclusive, check-out exclusive):
 *  maintenance : room is out of service (stored status; applies to every date)
 *  occupied    : a checked-in stay covers D (past dates: checked-out stays too; today: an overstaying guest still counts)
 *  cleaning    : today only, room is being cleaned after check-out
 *  reserved    : a pending/confirmed booking covers D (future bookings never make a room "occupied")
 *  available   : none of the above
 */
export async function roomStates(dateStr) {
  const s = await getSettings();
  const today = todayStr(s.timezone);
  const date = dateStr || today;
  const D = parseDay(date);
  const isPast = date < today; const isToday = date === today;
  const covering = { checkIn: { $lte: D }, checkOut: { $gt: D } };
  const [rooms, stays, overstays] = await Promise.all([
    Room.find().sort('number').lean(),
    Reservation.find({ ...covering, status: { $in: ['pending', 'confirmed', 'checked_in', ...(isPast ? ['checked_out'] : [])] } })
      .populate('guest', 'fullName').select('reference status guest checkIn checkOut rooms total paid').lean(),
    isToday ? Reservation.find({ status: 'checked_in', checkOut: { $lte: D } }).populate('guest', 'fullName').select('reference status guest checkIn checkOut rooms total paid').lean() : [],
  ]);
  const byRoom = new Map();
  for (const r of [...stays, ...overstays]) for (const l of r.rooms) { const k = String(l.room); byRoom.set(k, [...(byRoom.get(k) || []), r]); }
  const out = rooms.map((room) => {
    const rs = byRoom.get(String(room._id)) || [];
    const occ = rs.find((r) => ['checked_in', 'checked_out'].includes(r.status));
    const res = rs.find((r) => ['pending', 'confirmed'].includes(r.status));
    let state = 'available';
    if (room.status === 'maintenance') state = 'maintenance';
    else if (occ) state = 'occupied';
    else if (isToday && room.status === 'cleaning') state = 'cleaning';
    else if (res) state = 'reserved';
    const r = occ || res;
    return { _id: room._id, number: room.number, type: room.type, floor: room.floor, pricePerNight: room.pricePerNight, state,
      reservation: r ? { _id: r._id, reference: r.reference, status: r.status, guest: r.guest?.fullName, checkIn: r.checkIn, checkOut: r.checkOut } : null };
  });
  const counts = { total: out.length, available: 0, reserved: 0, occupied: 0, cleaning: 0, maintenance: 0 };
  out.forEach((r) => { counts[r.state] += 1; });
  return { date, today, counts, rooms: out };
}
