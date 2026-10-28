import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch, useList } from '../hooks/useList.js';
import { newKey } from '../utils/format.js';
import { Badge, DataTable, Empty, Field, Modal, PageHeader, Spinner, Tabs } from '../components/ui.jsx';

export function CheckInModal({ r, onClose, onDone }) {
  const { t, label, fmt } = useI18n(); const { settings } = useAuth();
  const key = useRef(newKey());
  const [dep, setDep] = useState(''); const [method, setMethod] = useState('cash'); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      if (r.status === 'pending') await api.post(`/reservations/${r._id}/confirm`);
      await api.post(`/reservations/${r._id}/check-in`, Number(dep) > 0 ? { deposit: { amount: Number(dep), method, idempotencyKey: key.current } } : {});
      toast.success(t('Guest checked in')); onDone();
    } catch (e) { toast.error(t(errMsg(e))); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${t('Check in')} · ${r.reference}`} footer={<><button type="button" className="btn-ghost" onClick={onClose}>{t('Cancel')}</button><button type="button" className="btn-gold" disabled={busy} onClick={submit}>{busy && <Spinner className="h-4 w-4" />}{t(r.status === 'pending' ? 'Confirm & check in' : 'Check in')}</button></>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-base font-semibold">{r.guest?.fullName}</p><p dir="ltr" className="text-slate-500">{r.guest?.phone}</p>
          <p className="mt-1">{t('Rooms')}: <b>{r.rooms.map((x) => x.room?.number).join(', ')}</b> · {fmt.date(r.checkIn)} → {fmt.date(r.checkOut)}</p>
          <p>{t('Total')}: <b>{fmt.money(r.total)}</b> · {t('Balance')}: <b>{fmt.money(r.balance)}</b></p></div>
        <p className="text-slate-500">{t('Verify the guest’s identity and room assignment before continuing.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('Deposit / initial payment (optional)')}><input className="input" type="number" min="0" step="any" value={dep} onChange={(e) => setDep(e.target.value)} /></Field>
          <Field label={t('Payment method')}><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{(settings?.paymentMethods || ['cash', 'card', 'bank_transfer']).map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
        </div>
      </div>
    </Modal>
  );
}

export function CheckOutModal({ r, onClose, onDone }) {
  const { t, label, fmt } = useI18n(); const { settings } = useAuth();
  const key = useRef(newKey());
  const [pay, setPay] = useState(r.balance > 0 ? String(r.balance) : ''); const [method, setMethod] = useState('cash'); const [allow, setAllow] = useState(false); const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, r.balance - (Number(pay) || 0));
  const submit = async () => {
    setBusy(true);
    try {
      if (Number(pay) > 0) await api.post('/payments', { reservationId: r._id, amount: Number(pay), method, idempotencyKey: key.current });
      await api.post(`/reservations/${r._id}/check-out`, { allowOutstanding: allow });
      toast.success(t('Guest checked out')); onDone();
    } catch (e) { toast.error(t(errMsg(e))); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${t('Check out')} · ${r.reference}`} footer={<><button type="button" className="btn-ghost" onClick={onClose}>{t('Cancel')}</button><button type="button" className="btn-gold" disabled={busy || (remaining > 0.009 && !allow)} onClick={submit}>{busy && <Spinner className="h-4 w-4" />}{t('Complete check-out')}</button></>}>
      <div className="space-y-4 text-sm">
        <p><b>{r.guest?.fullName}</b> · {t('Rooms')} {r.rooms.map((x) => x.room?.number).join(', ')}</p>
        <dl className="space-y-1 rounded-xl bg-slate-50 p-3">
          {[['Room charges', r.roomTotal], ['Services', r.servicesTotal]].map(([k, v]) => <div key={k} className="flex justify-between"><dt>{t(k)}</dt><dd>{fmt.money(v)}</dd></div>)}
          {r.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>{t('Discount')}</dt><dd>− {fmt.money(r.discount)}</dd></div>}
          <div className="flex justify-between"><dt>{t('Tax')}</dt><dd>{fmt.money(r.tax)}</dd></div>
          <div className="flex justify-between border-t pt-1 font-bold"><dt>{t('Total')}</dt><dd>{fmt.money(r.total)}</dd></div>
          <div className="flex justify-between"><dt>{t('Previous payments')}</dt><dd>{fmt.money(r.paid)}</dd></div>
          <div className="flex justify-between font-bold text-brand"><dt>{t('Balance due')}</dt><dd>{fmt.money(r.balance)}</dd></div>
        </dl>
        {r.balance > 0.009 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Collect now')}><input className="input" type="number" min="0" step="any" value={pay} onChange={(e) => setPay(e.target.value)} /></Field>
            <Field label={t('Payment method')}><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{(settings?.paymentMethods || ['cash', 'card', 'bank_transfer']).map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
            {remaining > 0.009 && <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={allow} onChange={(e) => setAllow(e.target.checked)} />{t('Record {n} as an outstanding balance', { n: fmt.money(remaining) })}</label>}
          </div>)}
      </div>
    </Modal>
  );
}

function Guestlike({ r }) { return <><Link className="font-semibold text-brand" to={`/reservations/${r._id}`}>{r.reference}</Link><div className="text-xs text-slate-500">{r.guest?.fullName}</div></>; }

export default function Reception() {
  const { t, fmt } = useI18n();
  const [tab, setTab] = useState('arrivals'); const [q, setQ] = useState(''); const [modal, setModal] = useState(null);
  const arrivals = useFetch('/reservations/arrivals'); const inhouse = useFetch('/reservations/in-house');
  const hist = useList('/audit', { action: 'reservation.check_in,reservation.check_out', limit: 15 }, tab === 'history');
  const match = (r) => !q || `${r.reference} ${r.guest?.fullName} ${r.guest?.phone} ${r.rooms.map((x) => x.room?.number).join(' ')}`.toLowerCase().includes(q.toLowerCase());
  const reload = () => { arrivals.reload(); inhouse.reload(); setModal(null); };
  const cols = (kind) => [
    { key: 'reference', label: t('Reservation'), render: (r) => <Guestlike r={r} /> }, { key: 'rooms', label: t('Rooms'), render: (r) => r.rooms.map((x) => x.room?.number).join(', ') },
    { key: 'dates', label: t('Stay'), render: (r) => `${fmt.date(r.checkIn)} → ${fmt.date(r.checkOut)}` },
    { key: 'status', label: t('Status'), render: (r) => <span className="flex gap-1"><Badge value={r.status} />{r.departingToday && <Badge value="due" tone="amber" />}</span> },
    { key: 'balance', label: t('Balance'), render: (r) => fmt.money(r.balance) },
    { key: 'act', label: '', render: (r) => <button type="button" className="btn-gold btn-sm" onClick={() => setModal({ kind, r })}>{t(kind === 'in' ? 'Check in' : 'Check out')}</button> },
  ];
  const sec = (src, kind) => <DataTable rows={(src.data || []).filter(match)} loading={src.loading} error={src.error} onRetry={src.reload} columns={cols(kind)} empty={<Empty title={t(kind === 'in' ? 'No arrivals waiting' : 'No guests in house')} />} />;
  return (
    <>
      <PageHeader title={t('Reception')} subtitle={t('Arrivals, departures and in-house guests')} />
      <div className="mb-3 flex flex-wrap gap-2 no-print"><input className="input max-w-sm" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Find by reference, guest, phone or room')} aria-label={t('Search')} /><Link className="btn-ghost" to="/reservations?new=1">{t('New walk-in reservation')}</Link></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'arrivals', label: `${t('Arrivals')} (${arrivals.data?.length ?? '…'})` }, { value: 'inhouse', label: `${t('In house')} (${inhouse.data?.length ?? '…'})` }, { value: 'history', label: t('History') }]} />
      {tab === 'arrivals' && sec(arrivals, 'in')}
      {tab === 'inhouse' && sec(inhouse, 'out')}
      {tab === 'history' && <DataTable rows={hist.data} loading={hist.loading} error={hist.error} meta={hist.meta} onPage={hist.setPage} columns={[
        { key: 'at', label: t('Time'), render: (a) => fmt.dateTime(a.createdAt) }, { key: 'action', label: t('Operation'), render: (a) => <Badge value={a.action.endsWith('check_in') ? 'checked_in' : 'checked_out'} /> },
        { key: 'ref', label: t('Reservation'), render: (a) => <Link className="text-brand" to={`/reservations/${a.entityId}`}>{a.meta?.reference}</Link> }, { key: 'by', label: t('By'), render: (a) => a.userName }]} />}
      {modal?.kind === 'in' && <CheckInModal r={modal.r} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.kind === 'out' && <CheckOutModal r={modal.r} onClose={() => setModal(null)} onDone={reload} />}
    </>
  );
}
