import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useList } from '../hooks/useList.js';
import { Badge, DataTable, PageHeader, SearchInput, Tabs } from '../components/ui.jsx';
import ReservationForm from '../components/ReservationForm.jsx';

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
export default function Reservations() {
  const { can } = useAuth(); const { t, label, fmt } = useI18n(); const nav = useNavigate();
  const [sp] = useSearchParams();
  const list = useList('/reservations', { sort: '-createdAt', search: sp.get('search') || '', status: sp.get('status') || '' });
  const [creating, setCreating] = useState(sp.get('new') === '1');
  const preset = sp.get('new') === '1' ? { checkIn: sp.get('checkIn') || undefined, checkOut: sp.get('checkOut') || undefined, adults: sp.get('adults') || undefined, roomIds: sp.get('roomId') ? sp.get('roomId').split(',') : undefined } : undefined;
  return (
    <>
      <PageHeader title={t('Reservations')} subtitle={t('Bookings, stays and billing')}>
        {can('super_admin', 'admin', 'receptionist') && <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} />{t('New reservation')}</button>}
      </PageHeader>
      <Tabs value={list.params.view || ''} onChange={(v) => list.set({ view: v, status: '' })} tabs={[['', 'All'], ['upcoming', 'Upcoming'], ['current', 'Current stays'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([value, l]) => ({ value, label: t(l) }))} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput initial={sp.get('search') || ''} placeholder={t('Reference, guest name or phone')} onChange={(v) => list.set({ search: v })} />
        <select className="input w-auto" aria-label={t('Status')} value={list.params.status} onChange={(e) => list.set({ status: e.target.value })}><option value="">{t('All statuses')}</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Check-in from')}<input className="input w-auto" type="date" onChange={(e) => list.set({ checkInFrom: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Check-in to')}<input className="input w-auto" type="date" onChange={(e) => list.set({ checkInTo: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Check-out from')}<input className="input w-auto" type="date" onChange={(e) => list.set({ checkOutFrom: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Check-out to')}<input className="input w-auto" type="date" onChange={(e) => list.set({ checkOutTo: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Booked from')}<input className="input w-auto" type="date" onChange={(e) => list.set({ createdFrom: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Booked to')}<input className="input w-auto" type="date" onChange={(e) => list.set({ createdTo: e.target.value })} /></label>
      </div>
      <DataTable rows={list.data} loading={list.loading} error={list.error} onRetry={list.reload} meta={list.meta} onPage={list.setPage} sort={list.params.sort} onSort={(s) => list.set({ sort: s })}
        onRowClick={(r) => nav(`/reservations/${r._id}`)}
        columns={[
          { key: 'reference', label: t('Reference'), sortKey: 'reference', render: (r) => <Link className="font-semibold text-brand" to={`/reservations/${r._id}`} onClick={(e) => e.stopPropagation()}>{r.reference}</Link> },
          { key: 'guest', label: t('Guest'), render: (r) => r.guest?.fullName }, { key: 'rooms', label: t('Rooms'), render: (r) => r.rooms.map((x) => x.room?.number).join(', ') },
          { key: 'checkIn', label: t('Check-in'), sortKey: 'checkIn', render: (r) => fmt.date(r.checkIn) }, { key: 'checkOut', label: t('Check-out'), sortKey: 'checkOut', render: (r) => fmt.date(r.checkOut) },
          { key: 'status', label: t('Status'), sortKey: 'status', render: (r) => <Badge value={r.status} /> }, { key: 'total', label: t('Total'), sortKey: 'total', render: (r) => fmt.money(r.total) },
          { key: 'pay', label: t('Payment'), render: (r) => <Badge value={r.paymentStatus} tone={{ paid: 'green', partial: 'amber', unpaid: 'red', refund_due: 'purple', none: 'slate' }[r.paymentStatus]} /> },
          { key: 'balance', label: t('Balance'), render: (r) => <span className={r.balance > 0 && !['cancelled', 'no_show'].includes(r.status) ? 'font-semibold text-brand' : 'text-slate-400'}>{fmt.money(r.balance)}</span> },
        ]} />
      {creating && <ReservationForm preset={preset} onClose={() => setCreating(false)} onSaved={(r) => nav(`/reservations/${r._id}`)} />}
    </>
  );
}
