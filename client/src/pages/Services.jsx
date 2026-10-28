import ResourcePage from '../components/ResourcePage.jsx';
import { Badge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';

export default function Services() {
  const { can } = useAuth(); const { t, fmt } = useI18n();
  const manage = can('super_admin', 'admin');
  return (
    <ResourcePage title={t('Services')} subtitle={t('Additional hotel services and charges')} url="/services" defaultSort="name" canCreate={manage} canEdit={manage} canDelete={manage} createLabel="Add service"
      defaults={{ active: true, price: 0 }} filters={[{ name: 'active', label: 'All', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }]}
      fields={[{ name: 'name', label: 'Name', required: true }, { name: 'price', label: 'Price', type: 'number', required: true, min: 0 }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Active' }]}
      columns={[{ key: 'name', label: t('Name'), sortKey: 'name', render: (s) => <b>{s.name}</b> }, { key: 'description', label: t('Description') }, { key: 'price', label: t('Price'), sortKey: 'price', render: (s) => fmt.money(s.price) },
        { key: 'active', label: t('Status'), render: (s) => <Badge value={s.active ? 'available' : 'cancelled'} tone={s.active ? 'green' : 'slate'} /> }]} />
  );
}
