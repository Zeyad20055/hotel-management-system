import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarX, BedDouble, CalendarCheck, CalendarClock, CircleDollarSign, DoorClosed, DoorOpen, Hammer, KeyRound, LogIn, LogOut, Percent, Users, Wallet, Wrench, CheckCircle2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch } from '../hooks/useList.js';
import { addDaysStr } from '../utils/format.js';
import { Badge, ErrorBox, PageHeader, Spinner, Stat } from '../components/ui.jsx';

const Card = ({ title, children, className = '' }) => <section className={`card p-5 ${className}`}><h2 className="mb-3 font-semibold text-ink">{title}</h2>{children}</section>;
const Row = ({ to, a, b, c }) => <li><Link to={to} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><span className="min-w-0"><b className="block truncate">{a}</b><span className="text-xs text-slate-500">{b}</span></span><span className="shrink-0">{c}</span></Link></li>;

export default function Dashboard() {
  const { t, label, fmt } = useI18n(); const { can } = useAuth(); const nav = useNavigate();
  const [date, setDate] = useState('');
  const s = useFetch(`/dashboard/summary${date ? `?date=${date}` : ''}`);
  const board = useFetch(`/rooms/occupancy${date ? `?date=${date}` : ''}`); const rev = useFetch('/dashboard/revenue?days=30'); const occ = useFetch('/dashboard/occupancy?days=14');
  void addDaysStr;
  if (s.loading && !s.data) return <div className="grid place-items-center py-20"><Spinner className="h-8 w-8 text-brand" /></div>;
  if (s.error) return <ErrorBox message={s.error} onRetry={s.reload} />;
  const d = s.data; const short = (v) => (v || '').slice(5);
  const tip = (v) => fmt.money(v);
  return (
    <>
      <PageHeader title={t('Dashboard')} subtitle={t('Live overview from your hotel database')}>
        <label className="flex items-center gap-2 text-xs text-slate-500">{t('Room status on')}<input className="input w-auto" type="date" value={date || d.date} onChange={(e) => setDate(e.target.value)} /></label>
        {date && <button type="button" className="btn-ghost btn-sm" onClick={() => setDate('')}>{t('Today')}</button>}
        {can('super_admin', 'admin', 'receptionist') && <>
          <button type="button" className="btn-primary" onClick={() => nav('/reservations?new=1')}><Plus size={16} />{t('New reservation')}</button>
          <button type="button" className="btn-ghost" onClick={() => nav('/reception')}><KeyRound size={16} />{t('Reception')}</button>
          <button type="button" className="btn-ghost" onClick={() => nav('/guests')}><Users size={16} />{t('Guests')}</button></>}
        <button type="button" className="btn-ghost" onClick={() => nav('/payments')}><Wallet size={16} />{t('Payments')}</button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={BedDouble} label={t('Total rooms')} value={fmt.num(d.rooms.total)} />
        <Stat icon={DoorOpen} tone="green" label={t('Available rooms')} value={fmt.num(d.rooms.available)} hint={t('Free on the selected date')} />
        <Stat icon={CalendarClock} tone="gold" label={t('Reserved rooms')} value={fmt.num(d.rooms.reserved)} hint={t('Booked, guest not yet in')} />
        <Stat icon={DoorClosed} label={t('Occupied rooms')} value={fmt.num(d.rooms.occupied)} hint={`${t('Occupancy')}: ${fmt.num(d.occupancyRate)}%`} />
        <Stat icon={Wrench} tone="slate" label={t('Under maintenance')} value={fmt.num(d.rooms.maintenance)} />
        <Stat icon={Hammer} tone="blue" label={t('Being cleaned')} value={fmt.num(d.rooms.cleaning)} />
        <Stat icon={CalendarX} tone="slate" label={t('Cancelled reservations')} value={fmt.num(d.cancelledReservations)} />
        <Stat icon={LogIn} tone="gold" label={t('Today’s check-ins')} value={fmt.num(d.todayCheckIns)} />
        <Stat icon={LogOut} tone="gold" label={t('Today’s check-outs')} value={fmt.num(d.todayCheckOuts)} />
        <Stat icon={CalendarCheck} tone="blue" label={t('Active reservations')} value={fmt.num(d.activeReservations)} />
        <Stat icon={CalendarClock} tone="blue" label={t('Upcoming reservations')} value={fmt.num(d.upcomingReservations)} />
        <Stat icon={Users} tone="slate" label={t('Total guests')} value={fmt.num(d.totalGuests)} />
        <Stat icon={CircleDollarSign} tone="green" label={t('Today’s revenue')} value={fmt.money(d.revenueToday)} hint={t('Collected')} />
        <Stat icon={Percent} tone="green" label={t('Monthly revenue')} value={fmt.money(d.revenueMonth)} hint={t('Collected this month')} />
        <Stat icon={Hammer} label={t('Outstanding payments')} value={fmt.money(d.outstandingPayments)} hint={`${fmt.num(d.outstandingCount)} ${t('reservations')}`} />
      </div>
      <Card title={`${t('Room board')} · ${fmt.date(d.date)}`} className="mt-5">
        <div className="flex flex-wrap gap-2">{(board.data?.rooms || []).map((r) => (
          <Link key={r._id} to={r.reservation ? `/reservations/${r.reservation._id}` : '/rooms'} title={r.reservation ? `${r.reservation.guest} · ${r.reservation.reference}` : label(r.state)}
            className={`min-w-[64px] rounded-lg border px-3 py-2 text-center text-sm ${{ available: 'border-emerald-200 bg-emerald-50 text-emerald-800', reserved: 'border-amber-200 bg-amber-50 text-amber-800', occupied: 'border-red-200 bg-red-50 text-red-800', cleaning: 'border-sky-200 bg-sky-50 text-sky-800', maintenance: 'border-slate-300 bg-slate-100 text-slate-600' }[r.state]}`}>
            <b>{r.number}</b><span className="block text-[10px] uppercase">{label(r.state)}</span></Link>))}</div>
        <p className="mt-3 text-xs text-slate-400">{t('Occupied = a checked-in guest stays that night. Reserved = a booking covers that night but the guest has not checked in. Check-out day is free.')}</p>
      </Card>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title={t('Revenue collected (30 days)')}><div className="h-64" dir="ltr"><ResponsiveContainer><AreaChart data={rev.data || []}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9b1c2c" stopOpacity={0.35} /><stop offset="95%" stopColor="#9b1c2c" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="date" tickFormatter={short} fontSize={11} /><YAxis fontSize={11} width={50} /><Tooltip formatter={tip} /><Area type="monotone" dataKey="revenue" stroke="#9b1c2c" fill="url(#g)" name={t('Revenue')} /></AreaChart></ResponsiveContainer></div></Card>
        <Card title={t('Room occupancy rate (14 days, %)')}><div className="h-64" dir="ltr"><ResponsiveContainer><LineChart data={occ.data || []}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="date" tickFormatter={short} fontSize={11} /><YAxis domain={[0, 100]} fontSize={11} width={40} /><Tooltip /><Line type="monotone" dataKey="rate" stroke="#c9a227" strokeWidth={2.5} dot={false} name={t('Occupancy')} /></LineChart></ResponsiveContainer></div></Card>
        <Card title={t('Reservations by status')}><div className="h-56" dir="ltr"><ResponsiveContainer><BarChart data={d.reservationsByStatus.map((x) => ({ ...x, name: label(x.status) }))}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={30} /><Tooltip /><Bar dataKey="count" fill="#17171a" radius={[6, 6, 0, 0]} name={t('Reservations')} /></BarChart></ResponsiveContainer></div></Card>
        <Card title={t('Recent payments')}>{d.recentPayments.length === 0 ? <p className="text-sm text-slate-400">{t('No payments yet')}</p> : <ul>{d.recentPayments.map((p) => <Row key={p._id} to={`/reservations/${p.reservation?._id}`} a={p.guest?.fullName} b={`${p.reference} · ${label(p.method)}`} c={<b>{fmt.money(p.amount)}</b>} />)}</ul>}</Card>
        <Card title={t('Upcoming arrivals')}>{d.upcomingArrivals.length === 0 ? <p className="text-sm text-slate-400">{t('No upcoming arrivals')}</p> : <ul>{d.upcomingArrivals.map((r) => <Row key={r._id} to={`/reservations/${r._id}`} a={r.guest?.fullName} b={`${r.reference} · ${t('Room')} ${r.rooms.map((x) => x.room?.number).join(', ')}`} c={<span className="text-xs text-slate-500">{fmt.date(r.checkIn)}</span>} />)}</ul>}</Card>
        <Card title={t('Upcoming departures')}>{d.upcomingDepartures.length === 0 ? <p className="text-sm text-slate-400">{t('No upcoming departures')}</p> : <ul>{d.upcomingDepartures.map((r) => <Row key={r._id} to={`/reservations/${r._id}`} a={r.guest?.fullName} b={`${r.reference} · ${t('Room')} ${r.rooms.map((x) => x.room?.number).join(', ')}`} c={<span className="text-xs text-slate-500">{fmt.date(r.checkOut)}</span>} />)}</ul>}</Card>
        <Card title={t('Recent reservations')} className="lg:col-span-2"><ul className="grid gap-x-6 sm:grid-cols-2">{d.recentReservations.map((r) => <Row key={r._id} to={`/reservations/${r._id}`} a={`${r.reference} · ${r.guest?.fullName}`} b={`${fmt.date(r.checkIn)} → ${fmt.date(r.checkOut)}`} c={<Badge value={r.status} />} />)}</ul></Card>
      </div>
      <p className="mt-4 flex items-center gap-1 text-xs text-slate-400"><CheckCircle2 size={12} />{t('Revenue figures are cash actually collected (net of refunds), not booked totals.')}</p>
    </>
  );
}
