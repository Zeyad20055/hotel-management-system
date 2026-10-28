import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ar from '../i18n/ar.js';
import { humanize, makeFmt } from '../utils/format.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);
export const useI18n = () => useContext(Ctx);

/**
 * English source strings are the keys; the Arabic dictionary maps them to translations.
 * Unknown strings fall back to English, so nothing ever renders blank.
 */
export function I18nProvider({ children }) {
  const { settings } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('hms_lang') || 'en');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('hms_lang', lang);
  }, [lang]);

  const t = useCallback((s, vars) => {
    let out = lang === 'ar' ? (ar[s] ?? s) : s;
    if (vars) Object.keys(vars).forEach((k) => { out = out.replaceAll(`{${k}}`, vars[k]); });
    return out;
  }, [lang]);
  const label = useCallback((v) => t(humanize(v)), [t]);
  const fmt = useMemo(() => makeFmt(lang, settings), [lang, settings]);

  const value = useMemo(() => ({ lang, setLang, t, label, fmt, dir: lang === 'ar' ? 'rtl' : 'ltr' }), [lang, t, label, fmt]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
