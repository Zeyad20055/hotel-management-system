import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import { ACTIVE_RES } from '../models/constants.js';

/** Room ids that have an active reservation overlapping [checkIn, checkOut) */
export async function busyRoomIds(checkIn, checkOut, excludeId) {
  const q = { status: { $in: ACTIVE_RES }, checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } };
  if (excludeId) q._id = { $ne: excludeId };
  const rs = await Reservation.find(q).select('rooms.room').lean();
  return new Set(rs.flatMap((r) => r.rooms.map((x) => String(x.room))));
}

/** Rooms bookable for the whole period: not in maintenance and with no overlapping active reservation. */
export async function availableRooms(checkIn, checkOut, { excludeId, filter = {} } = {}) {
  const busy = await busyRoomIds(checkIn, checkOut, excludeId);
  const rooms = await Room.find({ ...filter, status: { $ne: 'maintenance' } }).sort('number').lean();
  return rooms.filter((r) => !busy.has(String(r._id)));
}
