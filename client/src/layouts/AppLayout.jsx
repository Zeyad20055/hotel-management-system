import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarRange, DoorOpen, Bell, BedDouble, BarChart3, ChevronsLeft, ChevronsRight, ClipboardList, CreditCard, ConciergeBell, Home, Languages, LogOut, Menu, Settings, Sparkles, Users, UserCog, Wrench, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import api from '../api/client.js';

const A = ['super_admin', 'admin'];
export const NAV = [
  { to: '/', label: 'Dashboard', icon: Home, roles: [...A, 'receptionist', 'accountant'] },
  { to: '/reception', label: 'Reception', icon: KeyRound, roles: [...A, 'receptionist'] },
  { to: '/reservations', label: 'Reservations', icon: ClipboardList, roles: [...A, 'receptionist', 'accountant'] },
  { to: '/available-rooms', label: 'Available rooms', icon: DoorOpen, roles: [...A, 'receptionist'] },
  { to: '/reserved-rooms', label: 'Reserved rooms', icon: CalendarRange, roles: [...A, 'receptionist', 'accountant'] },
  { to: '/rooms', label: 'Rooms', icon: BedDouble, roles: [...A, 'receptionist', 'accountant', 'housekeeping'] },
  { to: '/guests', label: 'Guests', icon: Users, roles: [...A, 'receptionist', 'accountant'] },
  { to: '/payments', label: 'Payments', icon: CreditCard, roles: [...A, 'receptionist', 'accountant'] },
  { to: '/services', label: 'Services', icon: ConciergeBell, roles: [...A, 'receptionist', 'accountant'] },
  { to: '/housekeeping', label: 'Housekeeping', icon: Sparkles, roles: [...A, 'receptionist', 'housekeeping'] },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench, roles: [...A, 'receptionist', 'housekeeping'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: [...A, 'accountant'] },
  { to: '/employees', label: 'Employees', icon: UserCog, roles: A },
  { to: '/settings', label: 'Settings', icon: Settings, roles: A },
];

export default function AppLayout() {
  const { user, settings, logout } = useAuth();
  const { t, lang, setLang, label, dir } = useI18n();
  const nav = useNavigate(); const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hms_collapsed') === '1');
  const [drawer, setDrawer] = useState(false);
  const [bell, setBell] = useState(false); const [menu, setMenu] = useState(false);
  const [notes, setNotes] = useState(null); const [q, setQ] = useState('');
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const current = NAV.find((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)));

  useEffect(() => { setDrawer(false); setBell(false); setMenu(false); }, [loc.pathname]);
  useEffect(() => { localStorage.setItem('hms_collapsed', collapsed ? '1' : '0'); }, [collapsed]);
  useEffect(() => { api.get('/dashboard/notifications').then((r) => setNotes(r.data.data)).catch(() => {}); }, [loc.pathname]);
  const count = notes ? notes.arrivals + notes.departures + notes.tasks + notes.maintenance : 0;
  const Collapse = (dir === 'rtl') === collapsed ? ChevronsLeft : ChevronsRight;

  const side = (
    <aside className={`flex h-full flex-col bg-ink text-slate-300 transition-all ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64`}>
      <div className="flex h-16 items-center gap-3 border-b border-ink-line px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand font-serif text-lg text-gold">H</div>
        {!collapsed && <div className="min-w-0"><p className="truncate font-semibold text-white">{settings?.hotelName || 'Hotel'}</p><p className="text-[10px] uppercase tracking-widest text-gold">{t('Management')}</p></div>}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
        {items.map(({ to, label: l, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} title={t(l)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? 'bg-brand text-white shadow' : 'hover:bg-ink-soft hover:text-white'}`}>
            <Icon size={18} className="shrink-0" />{!collapsed && <span className="truncate">{t(l)}</span>}
          </NavLink>
        ))}
      </nav>
      <button type="button" onClick={() => setCollapsed(!collapsed)} className="m-3 hidden items-center justify-center gap-2 rounded-lg border border-ink-line py-2 text-xs hover:bg-ink-soft lg:flex" aria-label="Toggle sidebar"><Collapse size={16} />{!collapsed && t('Collapse')}</button>
    </aside>
  );

  return (
    <div className="flex h-full">
      <div className="hidden lg:block no-print">{side}</div>
      {drawer && <div className="fixed inset-0 z-40 flex lg:hidden no-print"><div className="h-full">{side}</div><div className="flex-1 bg-black/50" onClick={() => setDrawer(false)} /></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button type="button" className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setDrawer(true)} aria-label="Menu"><Menu size={20} /></button>
          <form className="hidden flex-1 sm:block sm:max-w-sm" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/reservations?search=${encodeURIComponent(q.trim())}`); }}>
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search reservations, guests...')} aria-label={t('Search')} />
          </form>
          <div className="ms-auto flex items-center gap-1.5">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}><Languages size={14} />{lang === 'en' ? 'العربية' : 'English'}</button>
            <div className="relative">
              <button type="button" className="relative rounded-lg p-2 hover:bg-slate-100" onClick={() => { setBell(!bell); setMenu(false); }} aria-label={t('Notifications')}>
                <Bell size={20} />{count > 0 && <span className="absolute end-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] text-white">{count}</span>}
              </button>
              {bell && (
                <div className="card absolute end-0 z-30 mt-2 w-64 animate-fade p-2 text-sm">
                  {[['arrivals', 'Pending arrivals', '/reception'], ['departures', 'Departures due', '/reception'], ['tasks', 'Open housekeeping tasks', '/housekeeping'], ['maintenance', 'Open maintenance', '/maintenance']].filter(([k]) => notes?.[k] > 0).map(([k, l, to]) => (
                    <Link key={k} to={to} className="flex justify-between rounded-lg px-3 py-2 hover:bg-slate-50"><span>{t(l)}</span><b className="text-brand">{notes[k]}</b></Link>
                  ))}
                  {count === 0 && <p className="px-3 py-2 text-slate-400">{t('You are all caught up')}</p>}
                </div>
              )}
            </div>
            <div className="relative">
              <button type="button" className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100" onClick={() => { setMenu(!menu); setBell(false); }}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{user.name?.[0]?.toUpperCase()}</span>
                <span className="hidden text-start leading-tight md:block"><span className="block text-sm font-medium">{user.name}</span><span className="block text-xs text-slate-500">{label(user.role)}</span></span>
              </button>
              {menu && (
                <div className="card absolute end-0 z-30 mt-2 w-48 animate-fade p-1 text-sm">
                  <Link to="/profile" className="block rounded-lg px-3 py-2 hover:bg-slate-50">{t('My profile')}</Link>
                  <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-red-600 hover:bg-red-50" onClick={logout}><LogOut size={14} />{t('Sign out')}</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <nav aria-label="Breadcrumb" className="no-print mb-3 text-xs text-slate-500">
            <Link to="/" className="hover:text-brand">{t('Home')}</Link>
            {current && current.to !== '/' && <> <span className="mx-1">/</span> <span className="text-slate-700">{t(current.label)}</span></>}
            {loc.pathname.split('/').length > 2 && <> <span className="mx-1">/</span> <span className="text-slate-700">{t('Details')}</span></>}
          </nav>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
