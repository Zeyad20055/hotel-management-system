import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errMsg } from '../api/client.js';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch } from '../hooks/useList.js';
import { isoDay } from '../utils/format.js';
import { Badge, ErrorBox, PageHeader, Spinner, Tabs } from '../components/ui.jsx';

const K = ({ label, value }) => <div className="rounded-xl bg-slate-50 p-3"><p className="label">{label}</p><p className="text-lg font-bold text-ink">{value}</p></div>;
const Table = ({ cols, rows, empty }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr>{cols.map((c) => <th key={c.k} className="th">{c.l}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{cols.map((c) => <td key={c.k} className="td">{c.r ? c.r(r) : r[c.k]}</td>)}</tr>)}{rows.length === 0 && <tr><td className="td text-slate-400" colSpan={cols.length}>{empty}</td></tr>}</tbody></table></div>
);

export default function Reports() {
  const { t, label, fmt } = useI18n();
  const [tab, setTab] = useState('revenue'); const [from, setFrom] = useState(isoDay(new Date(), -29)); const [to, setTo] = useState(isoDay()); const [group, setGroup] = useState('day');
  const qs = `from=${from}&to=${to}&group=${group}`;
  const { data: d, loading, error, reload } = useFetch(`/reports/${tab}?${qs}`);
  const csv = async () => {
    try { const r = await api.get(`/reports/${tab}?${qs}&format=csv`, { responseType: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = `${tab}-${from}_${to}.csv`; a.click(); URL.revokeObjectURL(a.href); } catch (e) { toast.error(t(errMsg(e))); }
  };
  const tip = (v) => fmt.money(v);
  const s = d?.summary;
  return (
    <>
      <PageHeader title={t('Reports')} subtitle={t('Accurate figures calculated from database records')}>
        <button type="button" className="btn-ghost" onClick={csv}><Download size={16} />{t('Export CSV')}</button>
        <button type="button" className="btn-ghost" onClick={() => window.print()}><Printer size={16} />{t('Print')}</button>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={['revenue', 'occupancy', 'reservations', 'payments', 'guests'].map((v) => ({ value: v, label: t(v.charAt(0).toUpperCase() + v.slice(1)) }))} />
      <div className="mb-4 flex flex-wrap items-end gap-3 no-print">
        <label className="text-xs text-slate-500">{t('From')}<input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-slate-500">{t('To')}<input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        {tab === 'revenue' && <label className="text-xs text-slate-500">{t('Group by')}<select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>{['day', 'month', 'year'].map((g) => <option key={g} value={g}>{t(g.charAt(0).toUpperCase() + g.slice(1))}</option>)}</select></label>}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d ? <div className="grid place-items-center py-16"><Spinner className="h-7 w-7 text-brand" /></div> : d && (
        <div className="print-area space-y-5">
          <h2 className="hidden text-lg font-bold print:block">{t(tab.charAt(0).toUpperCase() + tab.slice(1))} · {from} → {to}</h2>
          {tab === 'revenue' && <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><K label={t('Collected (cash in)')} value={fmt.money(s.collected)} /><K label={t('Booked revenue')} value={fmt.money(s.booked)} /><K label={t('Services revenue')} value={fmt.money(s.servicesRevenue)} /><K label={t('Refunded')} value={fmt.money(s.refunded)} /><K label={t('Outstanding')} value={fmt.money(s.outstanding)} /></div>
            <div className="card p-5"><div className="h-72" dir="ltr"><ResponsiveContainer><BarChart data={d.series}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} width={55} /><Tooltip formatter={tip} /><Legend /><Bar dataKey="collected" name={t('Collected')} fill="#9b1c2c" radius={[4, 4, 0, 0]} /><Bar dataKey="booked" name={t('Booked')} fill="#c9a227" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className="card p-5"><h3 className="mb-2 font-semibold">{t('Additional service revenue')}</h3><Table empty={t('No data')} rows={d.services} cols={[{ k: 'name', l: t('Service') }, { k: 'quantity', l: t('Quantity'), r: (r) => fmt.num(r.quantity) }, { k: 'revenue', l: t('Revenue'), r: (r) => fmt.money(r.revenue) }]} /></div>
            <p className="text-xs text-slate-500">{t('“Collected” is money actually received (net of refunds) by payment date. “Booked” is the value of reservations by arrival date, excluding cancelled and no-show bookings.')}</p></>}
          {tab === 'occupancy' && <>
            <div className="grid gap-3 sm:grid-cols-4"><K label={t('Average occupancy')} value={`${fmt.num(s.averageOccupancy)}%`} /><K label={t('Room-nights sold')} value={fmt.num(s.roomNightsSold)} /><K label={t('Room-nights available')} value={fmt.num(s.roomNightsAvailable)} /><K label={t('Average daily rate')} value={fmt.money(s.adr)} /></div>
            <div className="card p-5"><div className="h-72" dir="ltr"><ResponsiveContainer><LineChart data={d.series}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="date" fontSize={11} tickFormatter={(v) => v.slice(5)} /><YAxis domain={[0, 100]} fontSize={11} width={35} /><Tooltip /><Line dataKey="rate" stroke="#9b1c2c" strokeWidth={2.5} dot={false} name={t('Occupancy')} /></LineChart></ResponsiveContainer></div></div>
            <div className="card p-5"><h3 className="mb-2 font-semibold">{t('Room performance')}</h3><Table empty={t('No data')} rows={d.rooms} cols={[{ k: 'room', l: t('Room') }, { k: 'type', l: t('Type'), r: (r) => label(r.type) }, { k: 'nights', l: t('Nights'), r: (r) => fmt.num(r.nights) }, { k: 'occupancyRate', l: t('Occupancy'), r: (r) => `${fmt.num(r.occupancyRate)}%` }, { k: 'revenue', l: t('Room revenue'), r: (r) => fmt.money(r.revenue) }]} /></div></>}
          {tab === 'reservations' && <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5"><K label={t('Reservations')} value={fmt.num(s.total)} /><K label={t('Cancellation rate')} value={`${fmt.num(s.cancellationRate)}%`} /><K label={t('No-show rate')} value={`${fmt.num(s.noShowRate)}%`} /><K label={t('Check-ins')} value={fmt.num(s.checkIns)} /><K label={t('Check-outs')} value={fmt.num(s.checkOuts)} /></div>
            <div className="card flex flex-wrap gap-2 p-5">{Object.entries(s.byStatus).map(([k, v]) => <span key={k} className="flex items-center gap-1"><Badge value={k} /> <b>{fmt.num(v)}</b></span>)}</div>
            <div className="grid gap-5 lg:grid-cols-2"><div className="card p-5"><h3 className="mb-2 font-semibold">{t('Check-ins')}</h3><Table empty={t('No data')} rows={d.checkIns} cols={[{ k: 'reference', l: t('Reservation') }, { k: 'g', l: t('Guest'), r: (r) => r.guest?.fullName }, { k: 't', l: t('Time'), r: (r) => fmt.dateTime(r.checkedInAt) }]} /></div>
              <div className="card p-5"><h3 className="mb-2 font-semibold">{t('Check-outs')}</h3><Table empty={t('No data')} rows={d.checkOuts} cols={[{ k: 'reference', l: t('Reservation') }, { k: 'g', l: t('Guest'), r: (r) => r.guest?.fullName }, { k: 't', l: t('Time'), r: (r) => fmt.dateTime(r.checkedOutAt) }]} /></div></div></>}
          {tab === 'payments' && <>
            <div className="grid gap-3 sm:grid-cols-3"><K label={t('Collected')} value={fmt.money(s.collected)} /><K label={t('Payments')} value={fmt.num(s.payments)} /><K label={t('Outstanding balances')} value={fmt.money(s.outstanding)} /></div>
            <div className="card p-5"><h3 className="mb-2 font-semibold">{t('By payment method')}</h3><Table empty={t('No data')} rows={d.byMethod} cols={[{ k: 'method', l: t('Method'), r: (r) => label(r.method) }, { k: 'count', l: t('Payments'), r: (r) => fmt.num(r.count) }, { k: 'gross', l: t('Gross'), r: (r) => fmt.money(r.gross) }, { k: 'collected', l: t('Net collected'), r: (r) => fmt.money(r.collected) }]} /></div>
            <div className="card p-5"><h3 className="mb-2 font-semibold">{t('Outstanding balances')}</h3><Table empty={t('No data')} rows={d.outstanding} cols={[{ k: 'reference', l: t('Reservation') }, { k: 'guest', l: t('Guest') }, { k: 'status', l: t('Status'), r: (r) => <Badge value={r.status} /> }, { k: 'total', l: t('Total'), r: (r) => fmt.money(r.total) }, { k: 'balance', l: t('Balance'), r: (r) => <b className="text-brand">{fmt.money(r.balance)}</b> }]} /></div></>}
          {tab === 'guests' && <>
            <div className="grid gap-3 sm:grid-cols-3"><K label={t('Total guests')} value={fmt.num(s.totalGuests)} /><K label={t('New guests in period')} value={fmt.num(s.newGuests)} /><K label={t('Repeat guests')} value={fmt.num(s.repeatGuests)} /></div>
            <div className="grid gap-5 lg:grid-cols-2"><div className="card p-5"><h3 className="mb-2 font-semibold">{t('Top nationalities')}</h3><Table empty={t('No data')} rows={d.nationalities} cols={[{ k: 'nationality', l: t('Nationality') }, { k: 'guests', l: t('Guests'), r: (r) => fmt.num(r.guests) }]} /></div>
              <div className="card p-5"><h3 className="mb-2 font-semibold">{t('Repeat guests')}</h3><Table empty={t('No data')} rows={d.repeatGuests} cols={[{ k: 'name', l: t('Guest') }, { k: 'stays', l: t('Stays'), r: (r) => fmt.num(r.stays) }, { k: 'spent', l: t('Total spending'), r: (r) => fmt.money(r.spent) }]} /></div></div></>}
        </div>
      )}
    </>
  );
}
