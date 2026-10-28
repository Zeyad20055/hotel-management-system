import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useDebounced } from '../hooks/useList.js';
import { addDaysStr, dayOnly, isoDay } from '../utils/format.js';
import { Badge, Field, Modal, Spinner } from './ui.jsx';

function GuestPicker({ value, onChange }) {
  const { t } = useI18n();
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [res, setRes] = useState([]);
  useEffect(() => { if (dq.length < 2) { setRes([]); return; } api.get('/guests', { params: { search: dq, active: true, limit: 6 } }).then((r) => setRes(r.data.data)).catch(() => setRes([])); }, [dq]);
  if (value) return <div className="flex items-center justify-between rounded-lg border border-gold bg-gold-light/50 px-3 py-2 text-sm"><span><b>{value.fullName}</b> · <span dir="ltr">{value.phone}</span></span><button type="button" className="text-brand" onClick={() => onChange(null)}>{t('Change')}</button></div>;
  return (
    <div className="relative">
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search guest by name, phone, email or ID')} />
      {res.length > 0 && <ul className="card absolute z-10 mt-1 w-full overflow-hidden">{res.map((g) => <li key={g._id}><button type="button" className="block w-full px-3 py-2 text-start text-sm hover:bg-slate-50" onClick={() => { onChange(g); setQ(''); setRes([]); }}>{g.fullName} <span className="text-slate-400" dir="ltr">· {g.phone}</span></button></li>)}</ul>}
    </div>
  );
}

export default function ReservationForm({ reservation, preset, onClose, onSaved }) {
  const { t, label, fmt } = useI18n();
  const { settings } = useAuth();
  const today = settings?.today || isoDay();
  const edit = !!reservation;
  const [mode, setMode] = useState('existing');
  const [guest, setGuest] = useState(reservation?.guest || null);
  const [ng, setNg] = useState({ fullName: '', phone: '', email: '', nationality: '', idType: 'national_id', idNumber: '' });
  const [f, setF] = useState({ checkIn: edit ? dayOnly(reservation.checkIn) : preset?.checkIn || today, checkOut: edit ? dayOnly(reservation.checkOut) : preset?.checkOut || addDaysStr(today, 1), adults: reservation?.adults || Number(preset?.adults) || 2, children: reservation?.children || 0, discount: reservation?.discount || 0, notes: reservation?.notes || '', confirm: true });
  const [rooms, setRooms] = useState(new Set(edit ? reservation.rooms.map((x) => x.room._id) : preset?.roomIds || []));
  const [svc, setSvc] = useState({});
  const [services, setServices] = useState([]);
  const [avail, setAvail] = useState({ loading: false, list: [] });
  const [quote, setQuote] = useState(null); const [qErr, setQErr] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const validDates = f.checkIn && f.checkOut && f.checkIn < f.checkOut;

  useEffect(() => { if (!edit) api.get('/services', { params: { active: true, limit: 100 } }).then((r) => setServices(r.data.data)).catch(() => {}); }, [edit]);
  useEffect(() => {
    if (!validDates) { setAvail({ loading: false, list: [] }); return undefined; }
    let live = true; setAvail((a) => ({ ...a, loading: true }));
    api.get('/rooms/availability', { params: { checkIn: f.checkIn, checkOut: f.checkOut, excludeReservation: reservation?._id } })
      .then((r) => { if (!live) return; setAvail({ loading: false, list: r.data.data }); setRooms((s) => new Set([...s].filter((id) => r.data.data.some((x) => x._id === id)))); })
      .catch(() => live && setAvail({ loading: false, list: [] }));
    return () => { live = false; };
  }, [f.checkIn, f.checkOut, validDates, reservation?._id]);

  const services$ = useMemo(() => Object.entries(svc).filter(([, q]) => q > 0).map(([serviceId, quantity]) => ({ serviceId, quantity: Number(quantity) })), [svc]);
  const body = useMemo(() => ({ checkIn: f.checkIn, checkOut: f.checkOut, adults: Number(f.adults) || 1, children: Number(f.children) || 0, roomIds: [...rooms], services: services$, discount: Number(f.discount) || 0 }), [f, rooms, services$]);
  const dbody = useDebounced(JSON.stringify(body), 400);
  useEffect(() => {
    if (edit || !validDates || rooms.size === 0) { setQuote(null); setQErr(null); return; }
    api.post('/reservations/quote', JSON.parse(dbody)).then((r) => { setQuote(r.data.data); setQErr(null); }).catch((e) => { setQuote(null); setQErr(errMsg(e)); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbody]);

  const submit = async (e) => {
    e.preventDefault();
    if (!validDates) return toast.error(t('Check-out must be after check-in'));
    if (rooms.size === 0) return toast.error(t('Select at least one room'));
    if (mode === 'existing' && !guest) return toast.error(t('Select or register a guest'));
    if (mode === 'new' && (!ng.fullName || !ng.phone)) return toast.error(t('Guest name and phone are required'));
    setBusy(true);
    try {
      const payload = { ...body, notes: f.notes };
      let r;
      if (edit) { delete payload.services; r = await api.patch(`/reservations/${reservation._id}`, { ...payload, guestId: guest?._id }); }
      else r = await api.post('/reservations', { ...payload, confirm: f.confirm, ...(mode === 'existing' ? { guestId: guest._id } : { guest: Object.fromEntries(Object.entries(ng).filter(([, v]) => v)) }) });
      toast.success(t(edit ? 'Reservation updated' : 'Reservation created')); onSaved(r.data.data);
    } catch (err) { toast.error(t(errMsg(err))); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={edit ? `${t('Edit reservation')} · ${reservation.reference}` : t('New reservation')} wide
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>{t('Cancel')}</button><button form="res-form" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t(edit ? 'Save changes' : f.confirm ? 'Create & confirm' : 'Create as pending')}</button></>}>
      <form id="res-form" onSubmit={submit} className="space-y-5" noValidate>
        <section>
          <div className="mb-2 flex items-center gap-3"><h3 className="font-semibold">{t('Guest')}</h3>
            {!edit && <div className="flex gap-1 text-xs">{['existing', 'new'].map((m) => <button key={m} type="button" className={`rounded-full px-3 py-1 ${mode === m ? 'bg-brand text-white' : 'bg-slate-100'}`} onClick={() => setMode(m)}>{t(m === 'existing' ? 'Existing guest' : 'New guest')}</button>)}</div>}</div>
          {mode === 'existing' ? <GuestPicker value={guest} onChange={setGuest} /> : (
            <div className="grid gap-3 sm:grid-cols-3">
              {[['fullName', 'Full name'], ['phone', 'Phone'], ['email', 'Email'], ['nationality', 'Nationality'], ['idNumber', 'Identification number']].map(([k, l]) => <Field key={k} label={t(l)}><input className="input" value={ng[k]} onChange={(e) => setNg({ ...ng, [k]: e.target.value })} /></Field>)}
              <Field label={t('Identification type')}><select className="input" value={ng.idType} onChange={(e) => setNg({ ...ng, idType: e.target.value })}>{['national_id', 'passport', 'driver_license', 'other'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
            </div>)}
        </section>
        <section className="grid gap-3 sm:grid-cols-4">
          <Field label={t('Check-in')}><input className="input" type="date" value={f.checkIn} min={edit ? undefined : today} onChange={(e) => set('checkIn', e.target.value)} /></Field>
          <Field label={t('Check-out')}><input className="input" type="date" value={f.checkOut} min={f.checkIn} onChange={(e) => set('checkOut', e.target.value)} /></Field>
          <Field label={t('Adults')}><input className="input" type="number" min="1" value={f.adults} onChange={(e) => set('adults', e.target.value)} /></Field>
          <Field label={t('Children')}><input className="input" type="number" min="0" value={f.children} onChange={(e) => set('children', e.target.value)} /></Field>
          {!validDates && <p className="err sm:col-span-4">{t('Check-out must be after check-in')}</p>}
        </section>
        <section>
          <h3 className="mb-2 font-semibold">{t('Available rooms')} {avail.loading && <Spinner className="inline h-4 w-4 text-brand" />}</h3>
          {validDates && !avail.loading && avail.list.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{t('No rooms are available for these dates.')}</p>}
          <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {avail.list.map((r) => { const on = rooms.has(r._id); return (
              <label key={r._id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${on ? 'border-brand bg-brand-light' : 'border-slate-200 hover:border-gold'}`}>
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={() => setRooms((s) => { const n = new Set(s); if (on) n.delete(r._id); else n.add(r._id); return n; })} />
                <span className="min-w-0 flex-1"><b>{r.number}</b> · {label(r.type)}<br /><span className="text-xs text-slate-500">{t('Sleeps')} {fmt.num(r.capacity)} · {fmt.money(r.pricePerNight)}/{t('night')}</span></span>
              </label>); })}
          </div>
        </section>
        {!edit && services.length > 0 && (
          <section><h3 className="mb-2 font-semibold">{t('Optional services')}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{services.map((s) => (
              <div key={s._id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-2 text-sm"><span>{s.name}<br /><span className="text-xs text-slate-500">{fmt.money(s.price)}</span></span>
                <input type="number" min="0" max="100" className="input w-16 py-1" aria-label={s.name} value={svc[s._id] || 0} onChange={(e) => setSvc({ ...svc, [s._id]: Number(e.target.value) })} /></div>))}</div></section>)}
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label={t('Discount (amount)')} hint={t('Receptionists are limited by the hotel discount policy')}><input className="input" type="number" min="0" step="any" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></Field>
          <Field label={t('Notes')}><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          {!edit && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={f.confirm} onChange={(e) => set('confirm', e.target.checked)} />{t('Confirm the reservation immediately')}</label>}
        </section>
        <section className="rounded-xl border border-gold/50 bg-gold-light/40 p-4 text-sm">
          <h3 className="mb-2 font-semibold">{t('Price breakdown')}</h3>
          {edit && <p className="text-slate-500">{t('The price is recalculated by the server when you save.')}</p>}
          {qErr && <p className="err">{t(qErr)}</p>}
          {!edit && !quote && !qErr && <p className="text-slate-500">{t('Select dates and rooms to see the price.')}</p>}
          {quote && <dl className="space-y-1">
            {quote.rooms.map((r) => <div key={r.id} className="flex justify-between"><dt>{t('Room')} {r.number} × {fmt.num(quote.nights)} {t('nights')}</dt><dd>{fmt.money(r.subtotal)}</dd></div>)}
            {quote.charges.map((c, i) => <div key={i} className="flex justify-between"><dt>{c.name} × {fmt.num(c.quantity)}</dt><dd>{fmt.money(c.total)}</dd></div>)}
            <div className="flex justify-between border-t pt-1"><dt>{t('Subtotal')}</dt><dd>{fmt.money(quote.subtotal)}</dd></div>
            {quote.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>{t('Discount')}</dt><dd>− {fmt.money(quote.discount)}</dd></div>}
            <div className="flex justify-between"><dt>{t('Tax')} ({fmt.num(quote.taxRate)}%)</dt><dd>{fmt.money(quote.tax)}</dd></div>
            <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>{t('Total')}</dt><dd>{fmt.money(quote.total)}</dd></div></dl>}
        </section>
        <Badge value="pending" tone="slate" />
      </form>
    </Modal>
  );
}
