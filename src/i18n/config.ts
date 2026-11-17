export const locales = ["en"] as const;
// Planned: "es", "hi", "te", "zh". Add a JSON file in ./messages and append the code here.
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<string, string> = {
  en: "English",
  es: "Español",
  hi: "हिन्दी",
  te: "తెలుగు",
  zh: "中文",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
