import en from "./messages/en.json";
import { defaultLocale, type Locale } from "./config";

export type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = { en };

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

type Vars = Record<string, string | number>;

/** Look up a dot-path key ("home.hero.title1") and interpolate {vars}. */
export function translate(messages: Messages, key: string, vars?: Vars): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);

  if (typeof value !== "string") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] Missing translation key: ${key}`);
    }
    return key;
  }

  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Server-side helper: const t = getT(); t("nav.home") */
export function getT(locale: Locale = defaultLocale) {
  const messages = getMessages(locale);
  return (key: string, vars?: Vars) => translate(messages, key, vars);
}
