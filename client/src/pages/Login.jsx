import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { errMsg } from '../api/client.js';
import { Field, Spinner } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [busy, setBusy] = useState(false);
  const submit = async (v) => {
    setBusy(true);
    try { await login(v.email, v.password); } catch (e) { toast.error(t(errMsg(e))); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand font-serif text-2xl text-gold">H</div>
        <div><p className="font-serif text-4xl leading-tight">{t('Hospitality, perfectly orchestrated.')}</p><p className="mt-4 max-w-md text-slate-400">{t('Rooms, reservations, guests, payments and housekeeping in one place.')}</p></div>
        <div className="h-1 w-24 rounded bg-gold" />
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={handleSubmit(submit)} className="card w-full max-w-md space-y-4 p-8" noValidate>
          <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-ink">{t('Sign in')}</h1>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}><Languages size={14} />{lang === 'en' ? 'العربية' : 'English'}</button></div>
          <Field label={t('Email')} error={errors.email && t('A valid email is required')}><input className="input" type="email" autoComplete="username" {...register('email', { required: true, pattern: /^\S+@\S+$/ })} /></Field>
          <Field label={t('Password')} error={errors.password && t('Password is required')}><input className="input" type="password" autoComplete="current-password" {...register('password', { required: true })} /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Sign in')}</button>
        </form>
      </div>
    </div>
  );
}
