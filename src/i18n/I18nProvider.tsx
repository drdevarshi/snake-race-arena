"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { getMessages, translate } from "./translate";
import { defaultLocale, type Locale } from "./config";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const I18nContext = createContext<{ locale: Locale; t: TFn } | null>(null);

export function I18nProvider({ locale = defaultLocale, children }: { locale?: Locale; children: ReactNode }) {
  const messages = getMessages(locale);
  const t = useCallback<TFn>((key, vars) => translate(messages, key, vars), [messages]);
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

/** Client-side hook: const { t } = useT(); */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>");
  return ctx;
}
