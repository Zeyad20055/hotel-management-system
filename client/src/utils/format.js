export function makeFmt(lang, settings) {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const currency = settings?.currency || 'EGP';
  const tz = settings?.timezone || 'Africa/Cairo';
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat(locale);
  // Stay dates are date-only values stored at UTC midnight -> format in UTC so they never shift a day.
  const dateOnly = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateTime = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz });
  return {
    locale,
    money: (n) => money.format(Number(n) || 0),
    num: (n) => num.format(Number(n) || 0),
    date: (d) => (d ? dateOnly.format(new Date(d)) : '—'),
    dateTime: (d) => (d ? dateTime.format(new Date(d)) : '—'),
  };
}
export const humanize = (v) => (v == null ? '' : String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));
export const isoDay = (d = new Date(), offset = 0) => { const x = new Date(d); x.setDate(x.getDate() + offset); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const addDaysStr = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dayOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const newKey = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
