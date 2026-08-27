// ---------------------------------------------------------------------------
// LanguageContext — manages the active language (en, hi, gu, mr) and provides
// the t(key) translation helper function across the app.
// ---------------------------------------------------------------------------
import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { LANGUAGES, TRANSLATIONS, type LanguageKey, type LanguageOption } from '../config/i18n';

type LanguageContextValue = {
  lang: LanguageKey;
  setLang: (lang: LanguageKey) => void;
  t: (key: string) => string;
  languages: LanguageOption[];
};

const STORAGE_KEY = 'businesssathi_app_lang';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [lang, setLangState] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageKey;
    if (saved && TRANSLATIONS[saved]) return saved;
    return 'en';
  });

  function setLang(newLang: LanguageKey) {
    if (TRANSLATIONS[newLang]) {
      setLangState(newLang);
      localStorage.setItem(STORAGE_KEY, newLang);
    }
  }

  function t(key: string): string {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
