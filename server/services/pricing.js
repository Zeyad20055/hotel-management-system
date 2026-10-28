import { round } from '../utils/helpers.js';

export function computeTotals({ nights, rooms, charges, discount, taxRate }) {
  const roomTotal = round(rooms.reduce((s, r) => s + r.rate * nights, 0));
  const servicesTotal = round(charges.reduce((s, c) => s + c.total, 0));
  const subtotal = round(roomTotal + servicesTotal);
  const disc = Math.min(round(discount || 0), subtotal);
  const taxable = round(subtotal - disc);
  const tax = round((taxable * (taxRate || 0)) / 100);
  return { roomTotal, servicesTotal, subtotal, discount: disc, tax, total: round(taxable + tax) };
}
