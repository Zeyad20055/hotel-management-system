import mongoose from 'mongoose';
import { HttpError } from './errors.js';

export const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const isId = (v) => mongoose.isValidObjectId(v);

export function parseDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Dates must use the YYYY-MM-DD format');
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new HttpError(400, `Invalid date: ${s}`);
  return d;
}
export const todayStr = (tz = 'Africa/Cairo') => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
export const today = (tz) => parseDay(todayStr(tz));
export const nightsBetween = (a, b) => Math.round((b - a) / 86400000);
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
export const dayStr = (d) => new Date(d).toISOString().slice(0, 10);

// Serialises critical sections (booking, check-in...) inside one server process.
let chain = Promise.resolve();
export function withLock(fn) {
  const run = chain.then(() => fn());
  chain = run.catch(() => {});
  return run;
}

export async function paginate(Model, filter, req, { sortable = [], defaultSort = '-createdAt', populate, select } = {}) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const s = String(req.query.sort || '');
  const sort = s && sortable.includes(s.replace(/^-/, '')) ? s : defaultSort;
  let q = Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  if (populate) q = q.populate(populate);
  if (select) q = q.select(select);
  const [data, total] = await Promise.all([q.lean(), Model.countDocuments(filter)]);
  return { data, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}
/** unpaid | partial | paid (cancelled/no-show: 'refund_due' when money is still held, otherwise 'none') */
export function paymentStatusOf(r) {
  const paid = r.paid || 0; const total = r.total || 0;
  if (['cancelled', 'no_show'].includes(r.status)) return paid > 0.009 ? 'refund_due' : 'none';
  if (paid >= total - 0.009 && total > 0) return 'paid';
  return paid > 0.009 ? 'partial' : 'unpaid';
}
export const withBalance = (r) => ({ ...r, balance: round((r.total || 0) - (r.paid || 0)), paymentStatus: paymentStatusOf(r) });

/** Start (00:00 local time) of a YYYY-MM-DD day in the hotel time zone, as a UTC Date. */
export function zonedStart(dateStr, tz = 'Africa/Cairo') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  let guess = base;
  for (let i = 0; i < 2; i += 1) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess));
    const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    guess = base - (Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute, +g.second) - guess);
  }
  return new Date(guess);
}
