import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, Printer, Trash2 } from 'lucide-react';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch } from '../hooks/useList.js';
import { Badge, ErrorBox, PageHeader, Spinner, useConfirm } from '../components/ui.jsx';
import ReservationForm from '../components/ReservationForm.jsx';
import PaymentForm from '../components/PaymentForm.jsx';
import PrintDoc from '../components/PrintDoc.jsx';
import { CheckInModal, CheckOutModal } from './Reception.jsx';

export default function ReservationDetail() {
  const { id } = useParams();
  const { can } = useAuth(); const { t, label, fmt } = useI18n(); const confirm = useConfirm();
  const { data: r, loading, error, reload } = useFetch(`/reservations/${id}`);
  const { data: svcs } = useFetch('/services?active=true&limit=100');
  const [modal, setModal] = useState(null); const [print, setPrint] = useState('confirmation');
  const [svc, setSvc] = useState({ serviceId: '', quantity: 1 });
  if (loading && !r) return <div className="grid place-items-center py-20"><Spinner className="h-8 w-8 text-brand" /></div>;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const write = can('super_admin', 'admin', 'receptionist'); const money = can('super_admin', 'admin', 'accountant', 'receptionist');
  const open = ['pending', 'confirmed', 'checked_in'].includes(r.status);
  const act = async (path, body, ok) => { try { await api.post(`/reservations/${id}/${path}`, body || {}); toast.success(t(ok)); reload(); } catch (e) { toast.error(t(errMsg(e))); } };
  const cancel = async () => { if (await confirm({ title: t('Cancel reservation'), message: r.paid > 0 ? t('Payments of {n} were collected. Cancelling does not refund them automatically.', { n: fmt.money(r.paid) }) : t('The reserved rooms will be released.'), confirmLabel: t('Cancel reservation') })) act('cancel', {}, 'Reservation cancelled'); };
  const noShow = async () => { if (await confirm({ title: t('Mark as no-show'), message: t('The rooms will be released.'), confirmLabel: t('Confirm') })) act('no-show', {}, 'Marked as no-show'); };
  const addCharge = async () => { if (!svc.serviceId) return; try { await api.post(`/reservations/${id}/charges`, svc); toast.success(t('Charge added')); setSvc({ serviceId: '', quantity: 1 }); reload(); } catch (e) { toast.error(t(errMsg(e))); } };
  const rmCharge = async (c) => { try { await api.delete(`/reservations/${id}/charges/${c._id}`); reload(); } catch (e) { toast.error(t(errMsg(e))); } };
  const doPrint = (m) => { setPrint(m); setTimeout(() => window.print(), 60); };
  const done = () => { setModal(null); reload(); };

  return (
    <>
      <PageHeader title={r.reference} subtitle={`${r.guest?.fullName} · ${fmt.date(r.checkIn)} → ${fmt.date(r.checkOut)}`}>
        <Link to="/reservations" className="btn-ghost"><ArrowLeft size={16} className="rtl:rotate-180" />{t('Back')}</Link>
        <Badge value={r.status} />
        <button type="button" className="btn-ghost" onClick={() => doPrint('confirmation')}><Printer size={16} />{t('Confirmation')}</button>
        {money && <button type="button" className="btn-ghost" onClick={() => doPrint('invoice')}><Printer size={16} />{t('Invoice')}</button>}
      </PageHeader>
      {write && (
        <div className="mb-5 flex flex-wrap gap-2 no-print">
          {r.status === 'pending' && <button type="button" className="btn-primary" onClick={() => act('confirm', {}, 'Reservation confirmed')}>{t('Confirm')}</button>}
          {['pending', 'confirmed'].includes(r.status) && <button type="button" className="btn-ghost" onClick={() => setModal('edit')}><Pencil size={14} />{t('Edit')}</button>}
          {r.status === 'confirmed' && <button type="button" className="btn-gold" onClick={() => setModal('checkin')}>{t('Check in')}</button>}
          {r.status === 'checked_in' && <button type="button" className="btn-gold" onClick={() => setModal('checkout')}>{t('Check out')}</button>}
          {['pending', 'confirmed'].includes(r.status) && <button type="button" className="btn-ghost text-red-600" onClick={cancel}>{t('Cancel reservation')}</button>}
          {['pending', 'confirmed'].includes(r.status) && <button type="button" className="btn-ghost" onClick={noShow}>{t('No-show')}</button>}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3 no-print">
        <div className="space-y-5 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">{t('Stay details')}</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[['Guest', <Link key="g" className="text-brand" to="/guests">{r.guest?.fullName}</Link>], ['Phone', <span key="p" dir="ltr">{r.guest?.phone}</span>], ['Rooms', r.rooms.map((x) => `${x.room.number} (${label(x.room.type)})`).join(', ')],
                ['Check-in', fmt.date(r.checkIn)], ['Check-out', fmt.date(r.checkOut)], ['Nights', fmt.num(r.nights)], ['Adults', fmt.num(r.adults)], ['Children', fmt.num(r.children)],
                ['Checked in at', fmt.dateTime(r.checkedInAt)], ['Checked out at', fmt.dateTime(r.checkedOutAt)], ['Notes', r.notes || '—']].map(([k, v]) => <div key={k}><dt className="label">{t(k)}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
            {r.cancelReason && <p className="mt-3 text-sm text-red-600">{t('Cancel reason')}: {r.cancelReason}</p>}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">{t('Services & charges')}</h2>
            {r.charges.length === 0 ? <p className="text-sm text-slate-400">{t('No additional services')}</p> : (
              <ul className="divide-y text-sm">{r.charges.map((c) => <li key={c._id} className="flex items-center justify-between py-2"><span>{c.name} × {fmt.num(c.quantity)}</span><span className="flex items-center gap-3"><b>{fmt.money(c.total)}</b>
                {write && open && <button type="button" className="text-red-500" aria-label={t('Remove')} onClick={() => rmCharge(c)}><Trash2 size={14} /></button>}</span></li>)}</ul>)}
            {write && open && svcs && (
              <div className="mt-3 flex flex-wrap gap-2"><select className="input w-auto flex-1" value={svc.serviceId} aria-label={t('Service')} onChange={(e) => setSvc({ ...svc, serviceId: e.target.value })}><option value="">{t('Add a service…')}</option>{svcs.map((s) => <option key={s._id} value={s._id}>{s.name} — {fmt.money(s.price)}</option>)}</select>
                <input type="number" min="1" className="input w-20" aria-label={t('Quantity')} value={svc.quantity} onChange={(e) => setSvc({ ...svc, quantity: Number(e.target.value) })} /><button type="button" className="btn-ghost" onClick={addCharge}>{t('Add')}</button></div>)}
          </section>
          {money && (
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{t('Payments')}</h2>
                {r.balance > 0 && !['cancelled', 'no_show'].includes(r.status) && <button type="button" className="btn-primary btn-sm" onClick={() => setModal('pay')}>{t('Record payment')}</button>}</div>
              {r.payments.length === 0 ? <p className="text-sm text-slate-400">{t('No payments yet')}</p> : (
                <ul className="divide-y text-sm">{r.payments.map((p) => <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{p.reference}</b> · {label(p.method)} · {fmt.dateTime(p.paidAt)}</span><span className="flex items-center gap-2"><Badge value={p.status} /><b>{fmt.money(p.amount)}</b>{p.refundedAmount > 0 && <span className="text-purple-600">(− {fmt.money(p.refundedAmount)})</span>}</span></li>)}</ul>)}
            </section>)}
        </div>
        <aside className="card h-fit space-y-2 p-5 text-sm">
          <h2 className="mb-1 font-semibold">{t('Bill')}</h2>
          {[['Room charges', r.roomTotal], ['Services', r.servicesTotal], ['Subtotal', r.subtotal]].map(([k, v]) => <div key={k} className="flex justify-between"><span>{t(k)}</span><span>{fmt.money(v)}</span></div>)}
          {r.discount > 0 && <div className="flex justify-between text-emerald-700"><span>{t('Discount')}</span><span>− {fmt.money(r.discount)}</span></div>}
          <div className="flex justify-between"><span>{t('Tax')} ({fmt.num(r.taxRate)}%)</span><span>{fmt.money(r.tax)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>{t('Total')}</span><span>{fmt.money(r.total)}</span></div>
          <div className="flex justify-between"><span>{t('Paid')}</span><span>{fmt.money(r.paid)}</span></div>
          <div className={`flex justify-between rounded-lg p-2 font-bold ${r.balance > 0.009 ? 'bg-brand-light text-brand' : 'bg-emerald-50 text-emerald-700'}`}><span>{t('Balance')}</span><span>{fmt.money(r.balance)}</span></div>
        </aside>
      </div>
      <PrintDoc r={r} mode={print} />
      {modal === 'edit' && <ReservationForm reservation={r} onClose={() => setModal(null)} onSaved={done} />}
      {modal === 'pay' && <PaymentForm reservation={r} onClose={() => setModal(null)} onDone={reload} />}
      {modal === 'checkin' && <CheckInModal r={r} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'checkout' && <CheckOutModal r={r} onClose={() => setModal(null)} onDone={done} />}
    </>
  );
}
