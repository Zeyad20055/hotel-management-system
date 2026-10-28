import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Search, Users } from 'lucide-react';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { addDaysStr, isoDay } from '../utils/format.js';
import { Badge, Empty, ErrorBox, Field, PageHeader, Spinner } from '../components/ui.jsx';

const TYPES = ['single', 'double', 'twin', 'deluxe', 'suite', 'family', 'presidential_suite'];

export default function AvailableRooms() {
  const { settings } = useAuth(); const { t, label, fmt } = useI18n(); const nav = useNavigate();
  const today = settings?.today || isoDay();
  const [f, setF] = useState({ checkIn: today, checkOut: addDaysStr(today, 1), guests: 1, type: '', minPrice: '', maxPrice: '' });
  const [s, setS] = useState({ rooms: null, loading: false, error: null });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.checkIn && f.checkOut && f.checkIn < f.checkOut;

  const search = async (e) => {
    e?.preventDefault();
    if (!valid) return;
    setS({ rooms: null, loading: true, error: null });
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      setS({ rooms: (await api.get('/rooms/availability', { params })).data.data, loading: false, error: null });
    } catch (err) { setS({ rooms: null, loading: false, error: t(errMsg(err)) }); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { search(); }, []);

  const book = (r) => nav(`/reservations?new=1&roomId=${r._id}&checkIn=${f.checkIn}&checkOut=${f.checkOut}&adults=${f.guests}`);
  return (
    <>
      <PageHeader title={t('Available rooms')} subtitle={t('Rooms free for the whole selected period. Check-out day is free for the next guest.')} />
      <form onSubmit={search} className="card mb-5 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6" noValidate>
        <Field label={t('Check-in')}><input className="input" type="date" min={today} value={f.checkIn} onChange={(e) => set('checkIn', e.target.value)} /></Field>
        <Field label={t('Check-out')}><input className="input" type="date" min={f.checkIn} value={f.checkOut} onChange={(e) => set('checkOut', e.target.value)} /></Field>
        <Field label={t('Guests')}><input className="input" type="number" min="1" value={f.guests} onChange={(e) => set('guests', e.target.value)} /></Field>
        <Field label={t('Room type')}><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="">{t('All types')}</option>{TYPES.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
        <Field label={t('Min price')}><input className="input" type="number" min="0" value={f.minPrice} onChange={(e) => set('minPrice', e.target.value)} /></Field>
        <Field label={t('Max price')}><input className="input" type="number" min="0" value={f.maxPrice} onChange={(e) => set('maxPrice', e.target.value)} /></Field>
        {!valid && <p className="err sm:col-span-3 lg:col-span-6">{t('Check-out must be after check-in')}</p>}
        <div className="sm:col-span-3 lg:col-span-6"><button className="btn-primary" disabled={!valid || s.loading}>{s.loading ? <Spinner className="h-4 w-4" /> : <Search size={16} />}{t('Search available rooms')}</button></div>
      </form>
      {s.error && <ErrorBox message={s.error} onRetry={search} />}
      {s.rooms && (s.rooms.length === 0 ? <div className="card"><Empty title={t('No rooms are available for these dates.')} hint={t('Try other dates, fewer guests or a wider price range.')} /></div> : (
        <>
          <p className="mb-3 text-sm text-slate-500">{t('{n} rooms available', { n: fmt.num(s.rooms.length) })} · {fmt.num(s.rooms[0].nights)} {t('nights')}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{s.rooms.map((r) => (
            <div key={r._id} className="card overflow-hidden transition hover:shadow-md">
              <div className="relative h-32 bg-gradient-to-br from-ink to-ink-line">{r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : <BedDouble className="absolute inset-0 m-auto text-gold/60" size={40} />}<span className="absolute end-3 top-3"><Badge value="available" /></span></div>
              <div className="space-y-2 p-4">
                <div className="flex items-baseline justify-between"><h3 className="text-lg font-bold">{t('Room')} {r.number}</h3><span className="font-semibold text-brand">{fmt.money(r.pricePerNight)}<span className="text-xs text-slate-400">/{t('night')}</span></span></div>
                <p className="text-sm text-slate-500">{label(r.type)} · {t('Floor')} {fmt.num(r.floor)} · <Users className="inline" size={13} /> {fmt.num(r.capacity)}</p>
                {r.amenities?.length > 0 && <div className="flex flex-wrap gap-1">{r.amenities.slice(0, 4).map((a) => <span key={a} className="rounded-full bg-gold-light px-2 py-0.5 text-xs text-gold-dark">{a}</span>)}</div>}
                <p className="text-sm">{t('Stay total')}: <b>{fmt.money(r.stayTotal)}</b> <span className="text-xs text-slate-400">({t('before tax')})</span></p>
                <button type="button" className="btn-primary w-full" onClick={() => book(r)}>{t('Book this room')}</button>
              </div>
            </div>))}</div>
        </>))}
    </>
  );
}
