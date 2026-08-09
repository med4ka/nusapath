"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import id from "../i18n/id.json";
import en from "../i18n/en.json";
import de from "../i18n/de.json";

type Locale = "id" | "en" | "de";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DICTS: Record<Locale, Record<string, any>> = { id, en, de };

// Read nested value from dict using path "hero.title" → dict.hero.title.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lookup(dict: Record<string, any>, key: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = dict;
  const seg = key.split(".");
  for (const s of seg) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[s];
  }
  return cur;
}

// Replace {name} placeholders with values from params.
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`
  );
}

const STORAGE_KEY = "nusapath_locale";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("id");

  useEffect(() => {
    // Read localStorage via microtask (standard pattern AGENTS.md §4) — avoids
    // hydration mismatch (server always renders "id") while passing react-hooks.
    Promise.resolve().then(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && DICTS[saved]) setLocaleState(saved);
    });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = DICTS[locale];
      let value = lookup(dict, key);
      // Fallback to ID — never show empty/undefined text.
      if (value == null) value = lookup(DICTS.id, key);
      if (value == null) return key;
      return interpolate(String(value), params);
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}