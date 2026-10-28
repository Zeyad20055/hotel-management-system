import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useFetch, useList } from '../hooks/useList.js';
import { Badge, DataTable, Field, Modal, PageHeader, Tabs } from '../components/ui.jsx';

export default function Housekeeping() {
  const { user, can } = useAuth(); const { t, label, fmt } = useI18n();
  const manager = can('super_admin', 'admin', 'receptionist'); const [tab, setTab] = useState('tasks');
  const [status, setStatus] = useState('');
  const list = useList('/housekeeping', { limit: 15 });
  const board = useFetch('/housekeeping/rooms', [tab], manager && tab === 'board');
  const staff = useFetch('/users?role=housekeeping&limit=100', [], manager);
  const rooms = useFetch('/housekeeping/rooms', [], manager);
  const [creating, setCreating] = useState(false); const [form, setForm] = useState({ roomId: '', assignedTo: '', notes: '' });
  const patch = async (task, body) => { try { await api.patch(`/housekeeping/${task._id}`, body); toast.success(t('Task updated')); list.reload(); board.reload(); } catch (e) { toast.error(t(errMsg(e))); } };
  const create = async () => { try { await api.post('/housekeeping', { roomId: form.roomId, assignedTo: form.assignedTo || null, notes: form.notes }); toast.success(t('Task created')); setCreating(false); list.reload(); } catch (e) { toast.error(t(errMsg(e))); } };
  const next = { pending: ['in_progress', 'Start cleaning'], in_progress: ['needs_inspection', 'Ready for inspection'], needs_inspection: ['done', 'Approve (clean)'] };
  return (
    <>
      <PageHeader title={t('Housekeeping')} subtitle={user.role === 'housekeeping' ? t('Your assigned rooms') : t('Cleaning tasks and room status')}>{manager && <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} />{t('New task')}</button>}</PageHeader>
      {manager && <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tasks', label: t('Tasks') }, { value: 'board', label: t('Room board') }]} />}
      {tab === 'tasks' && <>
        <div className="mb-3"><select className="input w-auto" aria-label={t('Status')} value={status} onChange={(e) => { setStatus(e.target.value); list.set({ status: e.target.value }); }}><option value="">{t('All statuses')}</option>{['pending', 'in_progress', 'needs_inspection', 'done'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <DataTable rows={list.data} loading={list.loading} error={list.error} onRetry={list.reload} meta={list.meta} onPage={list.setPage} columns={[
          { key: 'room', label: t('Room'), render: (r) => <b>{r.room?.number}</b> }, { key: 'type', label: t('Type'), render: (r) => label(r.type) }, { key: 'status', label: t('Status'), render: (r) => <Badge value={r.status} /> },
          { key: 'who', label: t('Assigned to'), render: (r) => (manager ? <select className="input w-auto py-1" aria-label={t('Assigned to')} value={r.assignedTo?._id || ''} onChange={(e) => patch(r, { assignedTo: e.target.value || null })}><option value="">—</option>{(staff.data || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select> : r.assignedTo?.name) },
          { key: 'notes', label: t('Notes'), render: (r) => r.notes || '—' }, { key: 'at', label: t('Created'), render: (r) => fmt.dateTime(r.createdAt) },
          { key: 'act', label: '', render: (r) => { const n = next[r.status]; if (!n || (n[0] === 'done' && !manager)) return null; return <button type="button" className="btn-gold btn-sm" onClick={() => patch(r, { status: n[0] })}>{t(n[1])}</button>; } },
        ]} /></>}
      {tab === 'board' && <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{(board.data || []).map((r) => (
        <div key={r._id} className="card p-3 text-center"><p className="text-lg font-bold">{r.number}</p><div className="mt-1 flex flex-col items-center gap-1"><Badge value={r.status} /><Badge value={r.housekeepingStatus} /></div></div>))}</div>}
      <Modal open={creating} onClose={() => setCreating(false)} title={t('New housekeeping task')} footer={<><button type="button" className="btn-ghost" onClick={() => setCreating(false)}>{t('Cancel')}</button><button type="button" className="btn-primary" disabled={!form.roomId} onClick={create}>{t('Save')}</button></>}>
        <div className="space-y-4">
          <Field label={t('Room')}><select className="input" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}><option value="">—</option>{(rooms.data || []).map((r) => <option key={r._id} value={r._id}>{r.number}</option>)}</select></Field>
          <Field label={t('Assigned to')}><select className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">—</option>{(staff.data || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
          <Field label={t('Notes')}><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div></Modal>
    </>
  );
}
