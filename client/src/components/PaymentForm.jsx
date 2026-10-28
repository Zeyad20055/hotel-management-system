import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { newKey } from '../utils/format.js';
import { Field, Modal, Spinner } from './ui.jsx';

/** Records a payment. One idempotency key per opened form prevents duplicates from double-clicks / retries. */
export default function PaymentForm({ reservation, onClose, onDone }) {
  const { settings } = useAuth(); const { t, label, fmt } = useI18n();
  const key = useRef(newKey());
  const [amount, setAmount] = useState(reservation.balance > 0 ? String(reservation.balance) : '');
  const [method, setMethod] = useState('cash'); const [notes, setNotes] = useState(''); const [ref, setRef] = useState(''); const [busy, setBusy] = useState(false);
  const methods = settings?.paymentMethods || ['cash', 'card', 'bank_transfer'];
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!(Number(amount) > 0)) return toast.error(t('Enter a valid amount'));
    setBusy(true);
    try {
      await api.post('/payments', { reservationId: reservation._id, amount: Number(amount), method, notes, transactionRef: ref, idempotencyKey: key.current });
      toast.success(t('Payment recorded')); onDone?.(); onClose();
    } catch (err) { toast.error(t(errMsg(err))); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${t('Record payment')} · ${reservation.reference}`}
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>{t('Cancel')}</button><button form="pay-form" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Record payment')}</button></>}>
      <form id="pay-form" onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-slate-50 p-3 text-sm">{t('Outstanding balance')}: <b>{fmt.money(reservation.balance)}</b></p>
        <Field label={t('Amount')}><input className="input" type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={t('Payment method')}><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
        <Field label={t('Transaction reference (optional)')} hint={t('Bank / terminal slip number, entered manually')}><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label={t('Notes')}><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <p className="text-xs text-slate-400">{t('No card numbers are stored; record only the amount and method used at the terminal.')}</p>
      </form>
    </Modal>
  );
}
