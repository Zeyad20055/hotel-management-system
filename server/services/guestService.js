import Guest from '../models/Guest.js';
import { HttpError } from '../utils/errors.js';
import { esc } from '../utils/helpers.js';

export function normalizeGuest(d) {
  const out = { ...d };
  if (out.idNumber === '' || out.idNumber === undefined) delete out.idNumber;
  if (out.dateOfBirth === '' || out.dateOfBirth === undefined) delete out.dateOfBirth;
  else if (out.dateOfBirth) out.dateOfBirth = new Date(`${out.dateOfBirth}T00:00:00.000Z`);
  return out;
}

async function assertNoDuplicate(d, excludeId) {
  const ne = excludeId ? { _id: { $ne: excludeId } } : {};
  if (d.idNumber) {
    const dup = await Guest.findOne({ ...ne, idType: d.idType, idNumber: d.idNumber }).select('fullName');
    if (dup) throw new HttpError(409, `A guest with this ID number already exists (${dup.fullName})`, { field: 'idNumber', guestId: dup._id });
  }
  if (d.fullName && d.phone) {
    const dup = await Guest.findOne({ ...ne, phone: d.phone, fullName: new RegExp(`^${esc(d.fullName)}$`, 'i') }).select('_id');
    if (dup) throw new HttpError(409, 'A guest with the same name and phone already exists', { field: 'phone', guestId: dup._id });
  }
}

export async function createGuest(data) {
  const d = normalizeGuest(data);
  await assertNoDuplicate(d);
  return Guest.create(d);
}

export async function updateGuest(id, data) {
  const g = await Guest.findById(id);
  if (!g) throw new HttpError(404, 'Guest not found');
  const d = normalizeGuest(data);
  const merged = { idType: g.idType, idNumber: g.idNumber, fullName: g.fullName, phone: g.phone, ...d };
  await assertNoDuplicate(merged, g._id);
  if (data.idNumber === '') g.idNumber = undefined;
  if (data.dateOfBirth === '') g.dateOfBirth = undefined;
  g.set(d);
  await g.save();
  return g;
}
