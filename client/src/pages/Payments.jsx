import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Printer, Undo2 } from 'lucide-react';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useList } from '../hooks/useList.js';
import { Badge, DataTable, Field, Modal, PageHeader, SearchInput, Spinner } from '../components/ui.jsx';
import PaymentForm from '../components/PaymentForm.jsx';

function Picker({ onPick, onClose }) {
  const { t, fmt } = useI18n(); const list = useList('/reservations', { status: 'pending,confirmed,checked_in,checked_out', limit: 6 });
  return (
    <Modal open onClose={onClose} title={t('Choose a reservation')}>
      <SearchInput placeholder={t('Reference, guest name or phone')} onChange={(v) => list.set({ search: v })} />
      <ul className="mt-3 divide-y">{list.data.map((r) => <li key={r._id}><button type="button" className="flex w-full items-center justify-between gap-2 py-2 text-start text-sm hover:bg-slate-50" onClick={() => onPick(r)}><span><b>{r.reference}</b> · {r.guest?.fullName}</span><span>{fmt.money(r.balance)}</span></button></li>)}</ul>
      {list.loading && <Spinner className="mx-auto mt-3 text-brand" />}
    </Modal>
  );
}

export default function Payments() {
  const { can, settings } = useAuth(); const { t, label, fmt } = useI18n();
  const list = useList('/payments', { sort: '-paidAt' });
  const [pick, setPick] = useState(false); const [res, setRes] = useState(null); const [refund, setRefund] = useState(null); const [receipt, setReceipt] = useState(null);
  const [ra, setRa] = useState(''); const [rr, setRr] = useState(''); const [busy, setBusy] = useState(false);
  const canRefund = can('super_admin', 'admin', 'accountant');
  const doRefund = async () => {
    setBusy(true);
    try { await api.post(`/payments/${refund._id}/refund`, { amount: Number(ra), reason: rr }); toast.success(t('Refund recorded')); setRefund(null); list.reload(); } catch (e) { toast.error(t(errMsg(e))); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title={t('Payments')} subtitle={t('Collected payments, refunds and receipts')}><button type="button" className="btn-primary" onClick={() => setPick(true)}><Plus size={16} />{t('Record payment')}</button></PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        <SearchInput placeholder={t('Payment ref, reservation or guest')} onChange={(v) => list.set({ search: v })} />
        <select className="input w-auto" aria-label={t('Method')} onChange={(e) => list.set({ method: e.target.value })}><option value="">{t('All methods')}</option>{(settings?.paymentMethods || []).map((m) => <option key={m} value={m}>{label(m)}</option>)}</select>
        <select className="input w-auto" aria-label={t('Status')} onChange={(e) => list.set({ status: e.target.value })}><option value="">{t('All statuses')}</option>{['completed', 'pending', 'failed', 'partially_refunded', 'refunded'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('From')}<input className="input w-auto" type="date" onChange={(e) => list.set({ from: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('To')}<input className="input w-auto" type="date" onChange={(e) => list.set({ to: e.target.value })} /></label>
      </div>
      <DataTable rows={list.data} loading={list.loading} error={list.error} onRetry={list.reload} meta={list.meta} onPage={list.setPage} sort={list.params.sort} onSort={(s) => list.set({ sort: s })} columns={[
        { key: 'reference', label: t('Payment'), sortKey: 'reference', render: (p) => <b>{p.reference}</b> },
        { key: 'res', label: t('Reservation'), render: (p) => <Link className="text-brand" to={`/reservations/${p.reservation?._id}`}>{p.reservation?.reference}</Link> }, { key: 'guest', label: t('Guest'), render: (p) => p.guest?.fullName },
        { key: 'method', label: t('Method'), render: (p) => label(p.method) }, { key: 'txn', label: t('Transaction ref'), render: (p) => p.transactionRef || '—' }, { key: 'amount', label: t('Amount'), sortKey: 'amount', render: (p) => <span><b>{fmt.money(p.amount)}</b>{p.refundedAmount > 0 && <span className="block text-xs text-purple-600">− {fmt.money(p.refundedAmount)}</span>}</span> },
        { key: 'status', label: t('Status'), sortKey: 'status', render: (p) => <Badge value={p.status} /> }, { key: 'paidAt', label: t('Date'), sortKey: 'paidAt', render: (p) => fmt.dateTime(p.paidAt) }, { key: 'by', label: t('Recorded by'), render: (p) => p.recordedBy?.name },
        { key: 'act', label: '', render: (p) => <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm" aria-label={t('Receipt')} onClick={() => setReceipt(p)}><Printer size={14} /></button>
          {canRefund && ['completed', 'partially_refunded'].includes(p.status) && <button type="button" className="btn-ghost btn-sm" aria-label={t('Refund')} onClick={() => { setRefund(p); setRa(String(p.amount - p.refundedAmount)); setRr(''); }}><Undo2 size={14} /></button>}</div> },
      ]} />
      {pick && <Picker onClose={() => setPick(false)} onPick={(r) => { setPick(false); setRes(r); }} />}
      {res && <PaymentForm reservation={res} onClose={() => setRes(null)} onDone={list.reload} />}
      {refund && <Modal open onClose={() => setRefund(null)} title={`${t('Refund')} · ${refund.reference}`} footer={<><button type="button" className="btn-ghost" onClick={() => setRefund(null)}>{t('Cancel')}</button><button type="button" className="btn-danger" disabled={busy || rr.trim().length < 3 || !(Number(ra) > 0)} onClick={doRefund}>{t('Refund')}</button></>}>
        <div className="space-y-4"><p className="text-sm text-slate-500">{t('Refundable')}: {fmt.money(refund.amount - refund.refundedAmount)}</p>
          <Field label={t('Amount')}><input className="input" type="number" step="any" value={ra} onChange={(e) => setRa(e.target.value)} /></Field>
          <Field label={t('Reason (required, kept in the audit log)')}><input className="input" value={rr} onChange={(e) => setRr(e.target.value)} /></Field></div></Modal>}
      {receipt && <Modal open onClose={() => setReceipt(null)} title={t('Receipt')} footer={<button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={16} />{t('Print')}</button>}>
        <div className="print-area text-sm"><h2 className="text-xl font-bold">{settings?.hotelName}</h2><p className="mb-3 text-slate-500">{t('Payment receipt')}</p>
          {[['Payment', receipt.reference], ['Reservation', receipt.reservation?.reference], ['Guest', receipt.guest?.fullName], ['Method', label(receipt.method)], ['Date', fmt.dateTime(receipt.paidAt)], ['Amount', fmt.money(receipt.amount)], ['Refunded', fmt.money(receipt.refundedAmount)], ['Received by', receipt.recordedBy?.name]].map(([k, v]) => <div key={k} className="flex justify-between border-b py-1"><span>{t(k)}</span><b>{v}</b></div>)}</div></Modal>}
    </>
  );
}
