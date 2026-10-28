import { BedDouble, Users as UsersIcon } from 'lucide-react';
import ResourcePage from '../components/ResourcePage.jsx';
import { Badge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch } from '../hooks/useList.js';
import { Link } from 'react-router-dom';

const TYPES = ['single', 'double', 'twin', 'deluxe', 'suite', 'family', 'presidential_suite'];
const STATUSES = ['available', 'reserved', 'occupied', 'cleaning', 'maintenance'];

function RoomDetail({ id }) {
  const { data: r, loading } = useFetch(`/rooms/${id}`);
  const { t, label, fmt } = useI18n();
  if (loading || !r) return <p className="text-slate-400">…</p>;
  return (
    <div className="space-y-4 text-sm">
      {r.image && <img src={r.image} alt="" className="h-48 w-full rounded-xl object-cover" />}
      <div className="flex flex-wrap items-center gap-3"><h3 className="text-xl font-bold">{t('Room')} {r.number}</h3><Badge value={r.currentStatus} /><Badge value={r.housekeepingStatus} /></div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Type', label(r.type)], ['Floor', fmt.num(r.floor)], ['Capacity', fmt.num(r.capacity)], ['Beds', fmt.num(r.beds)], ['Price per night', fmt.money(r.pricePerNight)]].map(([k, v]) => <div key={k}><dt className="label">{t(k)}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      {r.description && <p className="text-slate-600">{r.description}</p>}
      {r.amenities?.length > 0 && <div className="flex flex-wrap gap-1.5">{r.amenities.map((a) => <span key={a} className="rounded-full bg-gold-light px-2.5 py-0.5 text-xs text-gold-dark">{a}</span>)}</div>}
      {r.upcomingReservations?.length > 0 && <div><p className="label">{t('Upcoming reservations')}</p>
        <ul className="divide-y rounded-xl border">{r.upcomingReservations.map((x) => <li key={x._id} className="flex justify-between gap-2 px-3 py-2"><Link className="font-medium text-brand" to={`/reservations/${x._id}`}>{x.reference}</Link><span>{x.guest?.fullName}</span><span className="text-slate-500">{fmt.date(x.checkIn)} → {fmt.date(x.checkOut)}</span></li>)}</ul></div>}
    </div>
  );
}

export default function Rooms() {
  const { can } = useAuth(); const { t, fmt } = useI18n();
  const manage = can('super_admin', 'admin');
  const fields = [
    { name: 'number', label: 'Room number', required: true }, { name: 'type', label: 'Room type', type: 'select', options: TYPES, required: true },
    { name: 'floor', label: 'Floor', type: 'number', required: true, min: 0 }, { name: 'capacity', label: 'Capacity', type: 'number', required: true, min: 1 },
    { name: 'beds', label: 'Number of beds', type: 'number', required: true, min: 1 }, { name: 'pricePerNight', label: 'Price per night', type: 'number', required: true, min: 0 },
    { name: 'status', label: 'Status', type: 'select', options: STATUSES.filter((s) => s !== 'occupied'), required: true, hint: 'Occupied is set automatically at check-in' },
    { name: 'housekeepingStatus', label: 'Housekeeping status', type: 'select', options: ['clean', 'dirty', 'cleaning', 'inspection'], required: true },
    { name: 'image', label: 'Image URL (optional)', full: true }, { name: 'amenities', label: 'Amenities (comma separated)', full: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
  return (
    <ResourcePage title={t('Rooms')} subtitle={t('Manage rooms, rates and availability')} url="/rooms" defaultSort="number" canCreate={manage} canEdit={manage} canDelete={manage}
      searchPlaceholder={t('Search by room number')} createLabel="Add room" fields={fields} detail={RoomDetail}
      defaults={{ type: 'double', floor: 1, capacity: 2, beds: 1, status: 'available', housekeepingStatus: 'clean', pricePerNight: 0, amenities: '' }}
      toForm={(r) => ({ ...r, amenities: (r.amenities || []).join(', ') })}
      toPayload={(v) => ({ ...v, amenities: String(v.amenities || '').split(',').map((s) => s.trim()).filter(Boolean) })}
      filters={[{ name: 'type', label: 'All types', options: TYPES }, { name: 'status', label: 'All statuses', options: STATUSES }, { name: 'floor', label: 'All floors', options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: `${t('Floor')} ${n}` })) },
        { name: 'maxPrice', label: 'Max price', type: 'number' }]}
      columns={[
        { key: 'number', label: t('Room'), sortKey: 'number', render: (r) => <b>{r.number}</b> }, { key: 'type', label: t('Type'), sortKey: 'type', render: (r) => <Badge value={r.type} tone="gold" /> },
        { key: 'floor', label: t('Floor'), sortKey: 'floor', render: (r) => fmt.num(r.floor) }, { key: 'capacity', label: t('Capacity'), sortKey: 'capacity', render: (r) => fmt.num(r.capacity) },
        { key: 'price', label: t('Price per night'), sortKey: 'pricePerNight', render: (r) => fmt.money(r.pricePerNight) },
        { key: 'status', label: t('Status'), sortKey: 'status', render: (r) => <Badge value={r.currentStatus} /> }, { key: 'hk', label: t('Housekeeping'), render: (r) => <Badge value={r.housekeepingStatus} /> },
      ]}
      card={(r, a) => (
        <div key={r._id} className="card overflow-hidden transition hover:shadow-md">
          <div className="relative h-28 bg-gradient-to-br from-ink to-ink-line">{r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : <BedDouble className="absolute inset-0 m-auto text-gold/60" size={40} />}
            <span className="absolute end-3 top-3"><Badge value={r.currentStatus} /></span></div>
          <div className="space-y-2 p-4">
            <div className="flex items-baseline justify-between"><h3 className="text-lg font-bold">{t('Room')} {r.number}</h3><span className="font-semibold text-brand">{fmt.money(r.pricePerNight)}</span></div>
            <p className="text-sm text-slate-500">{t(r.type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()))} · {t('Floor')} {fmt.num(r.floor)} · <UsersIcon className="inline" size={13} /> {fmt.num(r.capacity)}</p>
            <div className="flex gap-2 pt-1">{a.view && <button type="button" className="btn-ghost btn-sm flex-1" onClick={a.view}>{t('View')}</button>}{a.edit && <button type="button" className="btn-ghost btn-sm flex-1" onClick={a.edit}>{t('Edit')}</button>}</div>
          </div>
        </div>)}
    />
  );
}
