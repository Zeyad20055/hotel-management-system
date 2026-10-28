import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { useList } from '../hooks/useList.js';
import { Badge, DataTable, PageHeader, SearchInput } from '../components/ui.jsx';

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
export default function ReservedRooms() {
  const { t, label, fmt } = useI18n();
  const list = useList('/reservations', { sort: 'checkIn', status: 'pending,confirmed,checked_in', limit: 20 });
  // One row per room line: a multi-room booking appears once for every room it holds.
  const rows = list.data.flatMap((r) => r.rooms.map((l) => ({ ...r, _id: `${r._id}-${l.room?._id}`, rid: r._id, room: l.room, rate: l.rate })));
  return (
    <>
      <PageHeader title={t('Reserved rooms')} subtitle={t('Rooms with reservations: who, when and how much')} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder={t('Reference, guest name or phone')} onChange={(v) => list.set({ search: v })} />
        <select className="input w-auto" aria-label={t('Status')} value={list.params.status} onChange={(e) => list.set({ status: e.target.value })}>
          <option value="pending,confirmed,checked_in">{t('Active & upcoming')}</option><option value="">{t('All statuses')}</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Stay from')}<input className="input w-auto" type="date" onChange={(e) => list.set({ from: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t('Stay to')}<input className="input w-auto" type="date" onChange={(e) => list.set({ to: e.target.value })} /></label>
      </div>
      <DataTable rows={rows} loading={list.loading} error={list.error} onRetry={list.reload} meta={list.meta} onPage={list.setPage} columns={[
        { key: 'room', label: t('Room'), render: (r) => <b>{r.room?.number}</b> }, { key: 'guest', label: t('Guest'), render: (r) => r.guest?.fullName },
        { key: 'ref', label: t('Booking number'), render: (r) => <Link className="font-semibold text-brand" to={`/reservations/${r.rid}`}>{r.reference}</Link> },
        { key: 'in', label: t('Check-in'), render: (r) => fmt.date(r.checkIn) }, { key: 'out', label: t('Check-out'), render: (r) => fmt.date(r.checkOut) }, { key: 'n', label: t('Nights'), render: (r) => fmt.num(r.nights) },
        { key: 'total', label: t('Total'), render: (r) => fmt.money(r.total) }, { key: 'pay', label: t('Payment'), render: (r) => <Badge value={r.paymentStatus} tone={{ paid: 'green', partial: 'amber', unpaid: 'red', refund_due: 'purple', none: 'slate' }[r.paymentStatus]} /> },
        { key: 'status', label: t('Status'), render: (r) => <Badge value={r.status} /> },
      ]} />
    </>
  );
}
