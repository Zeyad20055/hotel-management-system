import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext.jsx';
import { useDebounced } from '../hooks/useList.js';

export const Spinner = ({ className = '' }) => <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 no-print">
      <div><h1 className="text-2xl font-bold text-ink">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', red: 'bg-red-50 text-red-700 ring-red-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200', slate: 'bg-slate-100 text-slate-600 ring-slate-200', purple: 'bg-purple-50 text-purple-700 ring-purple-200', gold: 'bg-gold-light text-gold-dark ring-gold/40',
};
const STATUS_TONE = {
  available: 'green', occupied: 'red', reserved: 'amber', cleaning: 'blue', maintenance: 'slate',
  pending: 'amber', confirmed: 'blue', checked_in: 'green', checked_out: 'slate', cancelled: 'red', no_show: 'purple',
  completed: 'green', failed: 'red', refunded: 'purple', partially_refunded: 'purple',
  dirty: 'red', clean: 'green', inspection: 'amber', in_progress: 'blue', needs_inspection: 'amber', done: 'green', open: 'amber',
  low: 'slate', medium: 'blue', high: 'amber', urgent: 'red', true: 'green', false: 'slate',
};
export function Badge({ value, tone }) {
  const { label } = useI18n();
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone || STATUS_TONE[value] || 'slate']}`}>{label(value)}</span>;
}

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    setTimeout(() => ref.current?.querySelector('input,select,textarea,button:not([data-close])')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6 no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`card my-4 w-full animate-fade ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button data-close type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

const ConfirmCtx = createContext(null);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }) {
  const [s, setS] = useState(null);
  const { t } = useI18n() || { t: (x) => x };
  const confirm = useCallback((opts) => new Promise((resolve) => setS({ opts, resolve })), []);
  const close = (v) => { s.resolve(v); setS(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!s} onClose={() => close(false)} title={s?.opts.title || t('Are you sure?')}
        footer={<><button type="button" className="btn-ghost" onClick={() => close(false)}>{t('Cancel')}</button><button type="button" className={s?.opts.danger === false ? 'btn-primary' : 'btn-danger'} onClick={() => close(true)}>{s?.opts.confirmLabel || t('Confirm')}</button></>}>
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-500" /><p className="text-sm text-slate-600">{s?.opts.message}</p></div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function Empty({ title, hint, action }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-gold-light p-4 text-gold-dark"><Inbox size={28} /></div>
      <p className="font-semibold text-slate-700">{title || t('Nothing here yet')}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Skeleton = ({ rows = 5, cols = 5 }) => (
  <tbody>{Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className="border-t border-slate-100">{Array.from({ length: cols }).map((__, j) => <td key={j} className="td"><div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${50 + ((i + j) % 4) * 12}%` }} /></td>)}</tr>
  ))}</tbody>
);

export function ErrorBox({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="m-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span>{message}</span>{onRetry && <button type="button" className="btn-ghost btn-sm" onClick={onRetry}>{t('Retry')}</button>}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  const { t, fmt, dir } = useI18n();
  if (!meta || meta.total === 0) return null;
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft; const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 no-print">
      <span>{t('{n} records', { n: fmt.num(meta.total) })}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-ghost btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label={t('Previous')}><Prev size={14} /></button>
        <span className="px-2">{t('Page {a} of {b}', { a: fmt.num(meta.page), b: fmt.num(meta.pages) })}</span>
        <button type="button" className="btn-ghost btn-sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label={t('Next')}><Next size={14} /></button>
      </div>
    </div>
  );
}

/** columns: [{ key, label, sortKey?, render?(row), className? }] */
export function DataTable({ columns, rows, loading, error, onRetry, sort, onSort, meta, onPage, empty, onRowClick }) {
  const { t } = useI18n();
  return (
    <div className="card overflow-hidden">
      {error && <ErrorBox message={error} onRetry={onRetry} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr>{columns.map((c) => {
            const active = sort && c.sortKey && sort.replace('-', '') === c.sortKey;
            return (
              <th key={c.key} className={`th ${c.className || ''}`} aria-sort={active ? (sort.startsWith('-') ? 'descending' : 'ascending') : undefined}>
                {c.sortKey && onSort ? <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => onSort(active && !sort.startsWith('-') ? `-${c.sortKey}` : c.sortKey)}>{c.label}<span className="text-gold-dark">{active ? (sort.startsWith('-') ? '↓' : '↑') : ''}</span></button> : c.label}
              </th>
            );
          })}</tr></thead>
          {loading && !rows.length ? <Skeleton cols={columns.length} /> : (
            <tbody>{rows.map((r, i) => (
              <tr key={r._id || i} className={`border-t border-slate-100 transition hover:bg-gold-light/40 ${onRowClick ? 'cursor-pointer' : ''} ${loading ? 'opacity-60' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => <td key={c.key} className={`td ${c.className || ''}`}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
              </tr>
            ))}</tbody>
          )}
        </table>
      </div>
      {!loading && !error && rows.length === 0 && (empty || <Empty title={t('No records found')} hint={t('Try adjusting your search or filters.')} />)}
      <Pagination meta={meta} onPage={onPage} />
    </div>
  );
}

export function SearchInput({ onChange, placeholder, initial = '' }) {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const d = useDebounced(v);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } onChange(d); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  return <input className="input min-w-[180px] flex-1 sm:max-w-xs" type="search" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder || t('Search...')} aria-label={placeholder || t('Search')} />;
}

export const Stat = ({ icon: Icon, label, value, tone = 'brand', hint, to }) => {
  const colors = { brand: 'bg-brand-light text-brand', gold: 'bg-gold-light text-gold-dark', green: 'bg-emerald-50 text-emerald-700', slate: 'bg-slate-100 text-slate-600', blue: 'bg-sky-50 text-sky-700' };
  const body = (
    <div className="card flex items-center gap-4 p-4 transition hover:shadow-md">
      <div className={`rounded-xl p-3 ${colors[tone]}`}><Icon size={22} /></div>
      <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="truncate text-xl font-bold text-ink">{value}</p>{hint && <p className="text-xs text-slate-400">{hint}</p>}</div>
    </div>
  );
  return to ? <a href={to} className="block">{body}</a> : body;
};

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 no-print">
      {tabs.map((tb) => (
        <button key={tb.value} role="tab" aria-selected={value === tb.value} type="button" onClick={() => onChange(tb.value)}
          className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${value === tb.value ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tb.label}</button>
      ))}
    </div>
  );
}
