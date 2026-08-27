// ---------------------------------------------------------------------------
// LanguageContext (mobile) — manages active language (en, hi, gu, mr).
// ---------------------------------------------------------------------------
import React, { createContext, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { LANGUAGES, TRANSLATIONS, type LanguageKey, type LanguageOption } from '../config/i18n';

type LanguageContextValue = {
  lang: LanguageKey;
  setLang: (lang: LanguageKey) => void;
  t: (key: string) => string;
  languages: LanguageOption[];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [lang, setLangState] = useState<LanguageKey>('en');

  function setLang(newLang: LanguageKey) {
    if (TRANSLATIONS[newLang]) {
      setLangState(newLang);
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
