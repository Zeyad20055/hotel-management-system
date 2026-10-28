import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { LayoutGrid, Pencil, Plus, Table2, Trash2, Eye } from 'lucide-react';
import api, { errMsg } from '../api/client.js';
import { useI18n } from '../context/I18nContext.jsx';
import { useList } from '../hooks/useList.js';
import { DataTable, Empty, Field, Modal, PageHeader, SearchInput, Spinner, useConfirm } from './ui.jsx';

function FormModal({ open, onClose, title, fields, initial, isEdit, onSubmit }) {
  const { t, label } = useI18n();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: initial });
  const [seed] = useState(0); void seed;
  const visible = fields.filter((f) => !(isEdit ? f.createOnly : f.editOnly));
  return (
    <Modal open={open} onClose={onClose} title={title} wide={visible.length > 8}
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>{t('Cancel')}</button><button form="resource-form" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}{t('Save')}</button></>}>
      <form id="resource-form" noValidate onSubmit={handleSubmit(async (v) => { if (await onSubmit(v)) reset(); })} className="grid gap-4 sm:grid-cols-2">
        {visible.map((f) => {
          const rules = { required: f.required && !(isEdit && f.type === 'password') ? t('Required') : false, min: f.min != null ? { value: f.min, message: t('Minimum is {n}', { n: f.min }) } : undefined, max: f.max != null ? { value: f.max, message: t('Maximum is {n}', { n: f.max }) } : undefined, minLength: f.minLength ? { value: f.minLength, message: t('Too short') } : undefined };
          const common = { id: `f-${f.name}`, ...register(f.name, rules) };
          return (
            <Field key={f.name} label={t(f.label)} hint={f.hint && t(f.hint)} error={errors[f.name]?.message} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {f.type === 'select' ? <select className="input" {...common}>{!f.required && <option value="">—</option>}{f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ? t(o.label) : label(o)}</option>)}</select>
                : f.type === 'textarea' ? <textarea rows={3} className="input" {...common} />
                : f.type === 'checkbox' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" {...common} />{t(f.checkLabel || 'Yes')}</label>
                : <input className="input" type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} autoComplete={f.type === 'password' ? 'new-password' : 'off'} {...common} />}
            </Field>
          );
        })}
      </form>
    </Modal>
  );
}

/** Generic searchable/sortable/paginated CRUD page bound to a REST resource. */
export default function ResourcePage({ title, subtitle, url, columns, filters = [], fields, canCreate, canEdit, canDelete, defaults = {}, toPayload = (v) => v, toForm = (r) => r, card, detail: Detail, defaultSort, createLabel, searchPlaceholder, limit = 10, deleteMessage }) {
  const { t } = useI18n(); const confirm = useConfirm();
  const list = useList(url, { sort: defaultSort || '', limit });
  const [view, setView] = useState('table');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const isEdit = !!editing?._id;

  const save = async (values) => {
    const payload = toPayload(Object.fromEntries(Object.entries(values).filter(([k, v]) => !(isEdit && fields.find((f) => f.name === k)?.type === 'password' && !v))));
    try {
      if (isEdit) await api.patch(`${url}/${editing._id}`, payload); else await api.post(url, payload);
      toast.success(t(isEdit ? 'Changes saved' : 'Created successfully'));
      setEditing(null); list.reload(); return true;
    } catch (e) { toast.error(t(errMsg(e))); return false; }
  };
  const remove = async (row) => {
    if (!(await confirm({ title: t('Delete record'), message: deleteMessage || t('This action cannot be undone. Records with history may be deactivated instead.'), confirmLabel: t('Delete') }))) return;
    try { const r = await api.delete(`${url}/${row._id}`); toast.success(t(r.data.data.deactivated ? 'Record deactivated (history is preserved)' : 'Deleted')); list.reload(); } catch (e) { toast.error(t(errMsg(e))); }
  };

  const cols = [...columns, { key: '_actions', label: '', className: 'w-32', render: (r) => (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {Detail && <button type="button" className="btn-ghost btn-sm" onClick={() => setViewing(r)} aria-label={t('View')}><Eye size={14} /></button>}
      {canEdit && <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(r)} aria-label={t('Edit')}><Pencil size={14} /></button>}
      {canDelete && <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(r)} aria-label={t('Delete')}><Trash2 size={14} /></button>}
    </div>) }];

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}>
        {card && <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          {[['table', Table2], ['cards', LayoutGrid]].map(([v, Icon]) => <button key={v} type="button" aria-pressed={view === v} aria-label={v} className={`p-2 ${view === v ? 'bg-brand text-white' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setView(v)}><Icon size={16} /></button>)}
        </div>}
        {canCreate && <button type="button" className="btn-primary" onClick={() => setEditing({ ...defaults })}><Plus size={16} />{t(createLabel || 'Add new')}</button>}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        <SearchInput placeholder={searchPlaceholder} onChange={(v) => list.set({ search: v })} />
        {filters.map((f) => (
          <select key={f.name} className="input w-auto" aria-label={t(f.label)} value={list.params[f.name] ?? ''} onChange={(e) => list.set({ [f.name]: e.target.value })}>
            <option value="">{t(f.label)}</option>{f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ? t(o.label) : t(String(o).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()))}</option>)}
          </select>
        ))}
        {filters.filter((f) => f.type === 'number').map((f) => <input key={f.name} type="number" className="input w-28" placeholder={t(f.label)} onChange={(e) => list.set({ [f.name]: e.target.value })} />)}
      </div>
      {view === 'cards' && card ? (
        <div>
          {list.loading && !list.data.length ? <div className="grid place-items-center py-16"><Spinner className="h-7 w-7 text-brand" /></div>
            : list.data.length === 0 ? <div className="card"><Empty title={t('No records found')} hint={t('Try adjusting your search or filters.')} /></div>
            : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{list.data.map((r) => card(r, { edit: canEdit ? () => setEditing(r) : null, view: Detail ? () => setViewing(r) : null }))}</div>}
        </div>
      ) : <DataTable columns={cols} rows={list.data} loading={list.loading} error={list.error} onRetry={list.reload} sort={list.params.sort} onSort={(s) => list.set({ sort: s })} meta={list.meta} onPage={list.setPage} onRowClick={Detail ? setViewing : undefined} />}
      {view === 'cards' && card && <div className="mt-3 text-center text-sm text-slate-500">{list.meta && <button type="button" className="btn-ghost btn-sm me-2" disabled={list.meta.page <= 1} onClick={() => list.setPage(list.meta.page - 1)}>‹</button>}{list.meta && `${list.meta.page} / ${list.meta.pages}`}{list.meta && <button type="button" className="btn-ghost btn-sm ms-2" disabled={list.meta.page >= list.meta.pages} onClick={() => list.setPage(list.meta.page + 1)}>›</button>}</div>}
      {editing && <FormModal key={editing._id || "new"} open title={t(isEdit ? 'Edit' : createLabel || 'Add new')} fields={fields} isEdit={isEdit} initial={isEdit ? toForm(editing) : editing} onClose={() => setEditing(null)} onSubmit={save} />}
      {viewing && Detail && <Modal open onClose={() => setViewing(null)} title={t('Details')} wide><Detail id={viewing._id} /></Modal>}
    </>
  );
}
