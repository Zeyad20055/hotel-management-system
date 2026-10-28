import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { Badge, Field, PageHeader } from '../components/ui.jsx';

function PasswordForm({ forced }) {
  const { refresh } = useAuth(); const { t } = useI18n();
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm();
  const submit = async (v) => {
    try { await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }); toast.success(t('Password changed')); reset(); await refresh(); } catch (e) { toast.error(t(errMsg(e))); }
  };
  return (
    <form onSubmit={handleSubmit(submit)} className="card max-w-md space-y-4 p-6" noValidate>
      {forced && <p className="rounded-lg bg-gold-light p-3 text-sm text-gold-dark">{t('For security you must choose a new password before continuing.')}</p>}
      <Field label={t('Current password')} error={errors.currentPassword && t('Required')}><input className="input" type="password" autoComplete="current-password" {...register('currentPassword', { required: true })} /></Field>
      <Field label={t('New password')} hint={t('At least 8 characters with a letter and a number')} error={errors.newPassword && t('At least 8 characters with a letter and a number')}>
        <input className="input" type="password" autoComplete="new-password" {...register('newPassword', { required: true, minLength: 8, pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/ })} /></Field>
      <Field label={t('Confirm new password')} error={errors.confirm && t('Passwords do not match')}>
        <input className="input" type="password" autoComplete="new-password" {...register('confirm', { validate: (x) => x === watch('newPassword') })} /></Field>
      <button className="btn-primary" disabled={isSubmitting}>{t('Change password')}</button>
    </form>
  );
}

export function ChangePasswordScreen({ forced }) {
  const { logout } = useAuth(); const { t } = useI18n();
  return <div className="grid min-h-full place-items-center p-6"><div className="w-full max-w-md"><h1 className="mb-4 text-2xl font-bold">{t('Change password')}</h1><PasswordForm forced={forced} /><button type="button" className="btn-ghost mt-4" onClick={logout}>{t('Sign out')}</button></div></div>;
}

export default function Profile() {
  const { user } = useAuth(); const { t, fmt } = useI18n();
  return (
    <>
      <PageHeader title={t('My profile')} />
      <div className="card mb-5 max-w-md space-y-1 p-6 text-sm">
        <p className="text-lg font-semibold">{user.name}</p><p className="text-slate-500">{user.email}</p>
        <div className="pt-2"><Badge value={user.role} tone="gold" /></div>
        <p className="pt-2 text-xs text-slate-400">{t('Last login')}: {fmt.dateTime(user.lastLoginAt)}</p>
      </div>
      <h2 className="mb-3 text-lg font-semibold">{t('Change password')}</h2>
      <PasswordForm />
    </>
  );
}
