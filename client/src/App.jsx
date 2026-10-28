import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import { useI18n } from './context/I18nContext.jsx';
import AppLayout, { NAV } from './layouts/AppLayout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import { ChangePasswordScreen } from './pages/Profile.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Rooms = lazy(() => import('./pages/Rooms.jsx'));
const AvailableRooms = lazy(() => import('./pages/AvailableRooms.jsx'));
const ReservedRooms = lazy(() => import('./pages/ReservedRooms.jsx'));
const Guests = lazy(() => import('./pages/Guests.jsx'));
const Reservations = lazy(() => import('./pages/Reservations.jsx'));
const ReservationDetail = lazy(() => import('./pages/ReservationDetail.jsx'));
const Reception = lazy(() => import('./pages/Reception.jsx'));
const Payments = lazy(() => import('./pages/Payments.jsx'));
const Services = lazy(() => import('./pages/Services.jsx'));
const Housekeeping = lazy(() => import('./pages/Housekeeping.jsx'));
const Maintenance = lazy(() => import('./pages/Maintenance.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Employees = lazy(() => import('./pages/Employees.jsx'));
const SettingsPage = lazy(() => import('./pages/Settings.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));

const Center = ({ children }) => <div className="grid h-full place-items-center p-6">{children}</div>;

export default function App() {
  const { status, user, refresh } = useAuth();
  const { t } = useI18n();
  if (status === 'loading') return <Center><Spinner className="h-8 w-8 text-brand" /></Center>;
  if (status === 'offline') {
    return (
      <Center><div className="card max-w-md p-8 text-center">
        <WifiOff className="mx-auto mb-3 text-brand" size={40} />
        <h1 className="text-xl font-bold">{t('Cannot reach the server')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('The backend API is not responding. Make sure it is running (npm run dev) and that the database is connected.')}</p>
        <button type="button" className="btn-primary mt-5" onClick={refresh}>{t('Try again')}</button>
      </div></Center>
    );
  }
  if (status === 'anon') return <Login />;
  if (user.mustChangePassword) return <ChangePasswordScreen forced />;

  const home = NAV.find((n) => n.roles.includes(user.role))?.to || '/profile';
  const guard = (path, el) => { const n = NAV.find((x) => x.to === path); return n && !n.roles.includes(user.role) ? <Navigate to={home} replace /> : el; };
  return (
    <Suspense fallback={<Center><Spinner className="h-8 w-8 text-brand" /></Center>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={guard('/', <Dashboard />)} />
          <Route path="reception" element={guard('/reception', <Reception />)} />
          <Route path="reservations" element={guard('/reservations', <Reservations />)} />
          <Route path="reservations/:id" element={guard('/reservations', <ReservationDetail />)} />
          <Route path="available-rooms" element={guard('/available-rooms', <AvailableRooms />)} />
          <Route path="reserved-rooms" element={guard('/reserved-rooms', <ReservedRooms />)} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="guests" element={guard('/guests', <Guests />)} />
          <Route path="payments" element={guard('/payments', <Payments />)} />
          <Route path="services" element={guard('/services', <Services />)} />
          <Route path="housekeeping" element={<Housekeeping />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="reports" element={guard('/reports', <Reports />)} />
          <Route path="employees" element={guard('/employees', <Employees />)} />
          <Route path="settings" element={guard('/settings', <SettingsPage />)} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
