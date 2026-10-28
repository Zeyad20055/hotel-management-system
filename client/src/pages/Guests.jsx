import { Link } from 'react-router-dom';
import ResourcePage from '../components/ResourcePage.jsx';
import { Badge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch } from '../hooks/useList.js';

function GuestProfile({ id }) {
  const { data: g, loading } = useFetch(`/guests/${id}`);
  const { t, label, fmt } = useI18n();
  if (loading || !g) return <p className="text-slate-400">…</p>;
  const s = g.stats;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold">{g.fullName}</h3>{!g.active && <Badge value="cancelled" tone="red" />}</div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[['Phone', g.phone], ['Email', g.email || '—'], ['Nationality', g.nationality || '—'], ['Identification', g.idNumber ? `${label(g.idType)} · ${g.idNumber}` : '—'], ['Address', g.address || '—'], ['Notes', g.notes || '—']].map(([k, v]) => <div key={k}><dt className="label">{t(k)}</dt><dd className="break-words font-medium" dir="auto">{v}</dd></div>)}
      </dl>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Total stays', fmt.num(s.totalStays)], ['Reservations', fmt.num(s.totalReservations)], ['Total spending', fmt.money(s.totalSpending)], ['Outstanding balance', fmt.money(s.outstandingBalance)]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="label">{t(k)}</p><p className="text-lg font-bold">{v}</p></div>)}
      </div>
      <div><p className="label">{t('Reservation history')}</p>
        {g.reservations.length === 0 ? <p className="text-slate-400">{t('No reservations yet')}</p> : (
          <ul className="divide-y rounded-xl border">{g.reservations.map((r) => <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><Link className="font-medium text-brand" to={`/reservations/${r._id}`}>{r.reference}</Link><span className="text-slate-500">{fmt.date(r.checkIn)} → {fmt.date(r.checkOut)}</span><span>{t('Room')} {r.rooms.join(', ')}</span><Badge value={r.status} /><b>{fmt.money(r.total)}</b></li>)}</ul>)}
      </div>
    </div>
  );
}

export default function Guests() {
  const { can } = useAuth(); const { t, fmt } = useI18n();
  const write = can('super_admin', 'admin', 'receptionist');
  const fields = [
    { name: 'fullName', label: 'Full name', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'nationality', label: 'Nationality' },
    { name: 'idType', label: 'Identification type', type: 'select', options: ['national_id', 'passport', 'driver_license', 'other'], required: true },
    { name: 'idNumber', label: 'Identification number', hint: 'Leave blank when editing to keep the current number' },
    { name: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { name: 'address', label: 'Address' },
    { name: 'notes', label: 'Notes', type: 'textarea' }, { name: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Active', editOnly: true },
  ];
  return (
    <ResourcePage title={t('Guests')} subtitle={t('Guest profiles and stay history')} url="/guests" canCreate={write} canEdit={write} canDelete={can('super_admin', 'admin')}
      searchPlaceholder={t('Search name, phone, email or ID')} createLabel="Add guest" fields={fields} detail={GuestProfile} defaultSort="-createdAt"
      defaults={{ idType: 'national_id' }} toForm={(g) => ({ ...g, idNumber: '', dateOfBirth: g.dateOfBirth ? g.dateOfBirth.slice(0, 10) : '' })}
      toPayload={(v) => { const o = { ...v }; if (!o.idNumber) delete o.idNumber; if (!o.dateOfBirth) delete o.dateOfBirth; return o; }}
      columns={[
        { key: 'fullName', label: t('Name'), sortKey: 'fullName', render: (g) => <span className="font-medium">{g.fullName}</span> }, { key: 'phone', label: t('Phone'), render: (g) => <span dir="ltr">{g.phone}</span> },
        { key: 'email', label: t('Email') }, { key: 'nationality', label: t('Nationality'), sortKey: 'nationality' }, { key: 'idNumber', label: t('ID'), render: (g) => <span dir="ltr">{g.idNumber || '—'}</span> },
        { key: 'createdAt', label: t('Created'), sortKey: 'createdAt', render: (g) => fmt.date(g.createdAt) }, { key: 'active', label: t('Status'), render: (g) => <Badge value={g.active ? 'available' : 'cancelled'} tone={g.active ? 'green' : 'red'} /> },
      ]} />
  );
}
