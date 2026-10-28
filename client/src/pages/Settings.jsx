import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { Field, PageHeader } from '../components/ui.jsx';

export default function Settings() {
  const { settings, reloadSettings } = useAuth(); const { t } = useI18n();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  useEffect(() => { if (settings) reset({ ...settings, customPaymentMethods: (settings.customPaymentMethods || []).join(', ') }); }, [settings, reset]);
  const save = async (v) => {
    try {
      await api.put('/settings', { hotelName: v.hotelName, currency: v.currency.toUpperCase(), taxRate: Number(v.taxRate), timezone: v.timezone, maxReceptionistDiscountPercent: Number(v.maxReceptionistDiscountPercent), customPaymentMethods: String(v.customPaymentMethods || '').split(',').map((s) => s.trim()).filter(Boolean) });
      await reloadSettings(); toast.success(t('Settings saved'));
    } catch (e) { toast.error(t(errMsg(e))); }
  };
  return (
    <>
      <PageHeader title={t('Settings')} subtitle={t('Hotel name, currency, tax and payment options')} />
      <form onSubmit={handleSubmit(save)} noValidate className="card grid max-w-3xl gap-4 p-6 sm:grid-cols-2">
        <Field label={t('Hotel name')} error={errors.hotelName && t('Required')}><input className="input" {...register('hotelName', { required: true })} /></Field>
        <Field label={t('Currency code')} hint="EGP, USD, EUR, SAR…" error={errors.currency && t('Use a 3-letter code')}><input className="input uppercase" maxLength={3} {...register('currency', { required: true, minLength: 3 })} /></Field>
        <Field label={t('Tax rate (%)')} error={errors.taxRate && t('Between 0 and 100')}><input className="input" type="number" step="any" {...register('taxRate', { required: true, min: 0, max: 100 })} /></Field>
        <Field label={t('Time zone')} hint="Africa/Cairo"><input className="input" {...register('timezone', { required: true })} /></Field>
        <Field label={t('Max receptionist discount (%)')} error={errors.maxReceptionistDiscountPercent && t('Between 0 and 100')}><input className="input" type="number" step="any" {...register('maxReceptionistDiscountPercent', { required: true, min: 0, max: 100 })} /></Field>
        <Field label={t('Extra payment methods')} hint={t('Comma separated, e.g. Vodafone Cash, InstaPay')}><input className="input" {...register('customPaymentMethods')} /></Field>
        <div className="sm:col-span-2"><button className="btn-primary" disabled={isSubmitting}>{t('Save')}</button></div>
      </form>
    </>
  );
}
