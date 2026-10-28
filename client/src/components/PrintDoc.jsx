import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';

/** Printable booking confirmation / invoice. Hidden on screen, the only visible thing when printing. */
export default function PrintDoc({ r, mode }) {
  const { settings } = useAuth(); const { t, label, fmt } = useI18n();
  const invoice = mode === 'invoice';
  const done = (r.payments || []).filter((p) => ['completed', 'partially_refunded', 'refunded'].includes(p.status));
  return (
    <div className="print-area print-only text-sm">
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div><h1 className="text-2xl font-bold">{settings?.hotelName}</h1><p>{t(invoice ? 'Invoice' : 'Booking confirmation')}</p></div>
        <div className="text-end"><p className="font-bold">{r.reference}</p><p>{fmt.dateTime(new Date())}</p></div>
      </div>
      <div className="my-4 grid grid-cols-2 gap-4">
        <div><p className="font-semibold">{t('Guest')}</p><p>{r.guest?.fullName}</p><p dir="ltr">{r.guest?.phone}</p></div>
        <div><p className="font-semibold">{t('Stay')}</p><p>{fmt.date(r.checkIn)} → {fmt.date(r.checkOut)} ({fmt.num(r.nights)} {t('nights')})</p><p>{t('Adults')}: {fmt.num(r.adults)} · {t('Children')}: {fmt.num(r.children)}</p><p>{t('Status')}: {label(r.status)}</p></div>
      </div>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-black text-start"><th className="py-1 text-start">{t('Description')}</th><th className="text-end">{t('Amount')}</th></tr></thead>
        <tbody>
          {r.rooms.map((x) => <tr key={x.room._id} className="border-b"><td className="py-1">{t('Room')} {x.room.number} ({label(x.room.type)}) — {fmt.money(x.rate)} × {fmt.num(r.nights)}</td><td className="text-end">{fmt.money(x.rate * r.nights)}</td></tr>)}
          {r.charges.map((c) => <tr key={c._id} className="border-b"><td className="py-1">{c.name} × {fmt.num(c.quantity)}</td><td className="text-end">{fmt.money(c.total)}</td></tr>)}
          <tr><td className="pt-2">{t('Subtotal')}</td><td className="pt-2 text-end">{fmt.money(r.subtotal)}</td></tr>
          {r.discount > 0 && <tr><td>{t('Discount')}</td><td className="text-end">− {fmt.money(r.discount)}</td></tr>}
          <tr><td>{t('Tax')} ({fmt.num(r.taxRate)}%)</td><td className="text-end">{fmt.money(r.tax)}</td></tr>
          <tr className="border-t border-black font-bold"><td className="pt-1">{t('Total')}</td><td className="pt-1 text-end">{fmt.money(r.total)}</td></tr>
        </tbody>
      </table>
      {invoice && (
        <>
          <h2 className="mb-1 mt-4 font-semibold">{t('Payments')}</h2>
          <table className="w-full"><tbody>
            {done.map((p) => <tr key={p._id} className="border-b"><td className="py-1">{p.reference} · {label(p.method)} · {fmt.dateTime(p.paidAt)}</td><td className="text-end">{fmt.money(p.amount - p.refundedAmount)}</td></tr>)}
            <tr className="font-bold"><td className="pt-1">{t('Balance due')}</td><td className="pt-1 text-end">{fmt.money(r.balance)}</td></tr>
          </tbody></table>
        </>
      )}
      <p className="mt-8 text-xs text-slate-500">{t('Thank you for staying with us.')}</p>
    </div>
  );
}
