import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch, useList } from '../hooks/useList.js';
import { Badge, DataTable, Field, Modal, PageHeader } from '../components/ui.jsx';

export default function Maintenance() {
  const { can } = useAuth(); const { t, label, fmt } = useI18n();
  const manager = can('super_admin', 'admin', 'receptionist'); const [status, setStatus] = useState('');
  const list = useList('/maintenance', { limit: 15 });
  const rooms = useFetch('/rooms?limit=200&sort=number');
  const staff = useFetch('/users?limit=100&active=true', [], manager);
  const [open, setOpen] = useState(false); const [f, setF] = useState({ roomId: '', title: '', description: '', priority: 'medium', blockRoom: true, assignedTo: '' });
  const create = async () => {
    try { const r = await api.post('/maintenance', { ...f, assignedTo: f.assignedTo || null }); toast.success(t('Request created')); if (r.data.data.upcomingReservationsAffected > 0) toast(t('{n} upcoming reservations use this room; review them.', { n: r.data.data.upcomingReservationsAffected }), { icon: '⚠️', duration: 6000 }); setOpen(false); list.reload(); } catch (e) { toast.error(t(errMsg(e))); }
  };
  const patch = async (m, body) => { try { await api.patch(`/maintenance/${m._id}`, body); toast.success(t('Request updated')); list.reload(); } catch (e) { toast.error(t(errMsg(e))); } };
  return (
    <>
      <PageHeader title={t('Maintenance')} subtitle={t('Repair requests and history. Blocking requests remove the room from booking.')}><button type="button" className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />{t('New request')}</button></PageHeader>
      <div className="mb-3"><select className="input w-auto" aria-label={t('Status')} value={status} onChange={(e) => { setStatus(e.target.value); list.set({ status: e.target.value }); }}><option value="">{t('All statuses')}</option>{['open', 'in_progress', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
      <DataTable rows={list.data} loading={list.loading} error={list.error} onRetry={list.reload} meta={list.meta} onPage={list.setPage} columns={[
        { key: 'room', label: t('Room'), render: (m) => <b>{m.room?.number}</b> }, { key: 'title', label: t('Issue'), render: (m) => <span>{m.title}<span className="block text-xs text-slate-500">{m.description}</span></span> },
        { key: 'priority', label: t('Priority'), render: (m) => <Badge value={m.priority} /> }, { key: 'status', label: t('Status'), render: (m) => <Badge value={m.status} /> },
        { key: 'who', label: t('Assigned to'), render: (m) => (manager && ['open', 'in_progress'].includes(m.status) ? <select className="input w-auto py-1" aria-label={t('Assigned to')} value={m.assignedTo?._id || ''} onChange={(e) => patch(m, { assignedTo: e.target.value || null })}><option value="">—</option>{(staff.data || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select> : m.assignedTo?.name || '—') },
        { key: 'created', label: t('Created'), render: (m) => fmt.dateTime(m.createdAt) }, { key: 'done', label: t('Completed'), render: (m) => fmt.dateTime(m.completedAt) },
        { key: 'act', label: '', render: (m) => (m.status === 'open' ? <button type="button" className="btn-ghost btn-sm" onClick={() => patch(m, { status: 'in_progress' })}>{t('Start')}</button> : m.status === 'in_progress' ? <button type="button" className="btn-gold btn-sm" onClick={() => patch(m, { status: 'completed' })}>{t('Complete')}</button> : null) },
      ]} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('New maintenance request')} footer={<><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t('Cancel')}</button><button type="button" className="btn-primary" disabled={!f.roomId || f.title.length < 3} onClick={create}>{t('Save')}</button></>}>
        <div className="space-y-4">
          <Field label={t('Room')}><select className="input" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">—</option>{(rooms.data || []).map((r) => <option key={r._id} value={r._id}>{r.number}</option>)}</select></Field>
          <Field label={t('Issue')}><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label={t('Description')}><textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Priority')}><select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{label(p)}</option>)}</select></Field>
            {manager && <Field label={t('Assigned to')}><select className="input" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })}><option value="">—</option>{(staff.data || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={f.blockRoom} onChange={(e) => setF({ ...f, blockRoom: e.target.checked })} />{t('Take the room out of service (cannot be booked)')}</label>
        </div>
      </Modal>
    </>
  );
}
