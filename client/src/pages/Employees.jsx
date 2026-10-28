import ResourcePage from '../components/ResourcePage.jsx';
import { Badge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';

export default function Employees() {
  const { user, can } = useAuth(); const { t, fmt } = useI18n();
  const roles = can('super_admin') ? ['super_admin', 'admin', 'receptionist', 'accountant', 'housekeeping'] : ['admin', 'receptionist', 'accountant', 'housekeeping'];
  return (
    <ResourcePage title={t('Employees')} subtitle={t('Accounts and role-based access')} url="/users" defaultSort="name" canCreate canEdit createLabel="Add employee" defaults={{ role: 'receptionist', active: true }}
      filters={[{ name: 'role', label: 'All roles', options: roles }]}
      fields={[{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'role', label: 'Role', type: 'select', options: roles, required: true },
        { name: 'password', label: 'Password', type: 'password', required: true, minLength: 8, hint: 'Required for new accounts; when editing it resets the password (user must change it at next login)' },
        { name: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Active (uncheck to deactivate)', editOnly: true }]}
      toForm={(u) => ({ ...u, password: '' })}
      columns={[{ key: 'name', label: t('Name'), sortKey: 'name', render: (u) => <span className="font-medium">{u.name}{u._id === user._id && <span className="ms-2 text-xs text-slate-400">({t('you')})</span>}</span> },
        { key: 'email', label: t('Email'), sortKey: 'email' }, { key: 'role', label: t('Role'), sortKey: 'role', render: (u) => <Badge value={u.role} tone="gold" /> },
        { key: 'active', label: t('Status'), render: (u) => <Badge value={u.active ? 'available' : 'cancelled'} tone={u.active ? 'green' : 'red'} /> }, { key: 'last', label: t('Last login'), render: (u) => fmt.dateTime(u.lastLoginAt) }]} />
  );
}
