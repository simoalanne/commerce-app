import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { type ContentLocale, contentLocales } from "@/lib/locales";

const DASHBOARD_CONTENT_LOCALE_STORAGE_KEY = "@dashboard:content-locale";

type LocalizedTextValue = Record<string, string | string[] | null | undefined>;

type LocalizationContextValue = {
  contentLocale: ContentLocale;
  setContentLocale: (locale: ContentLocale) => void;
  resolveLocalizedValue: (
    value: unknown,
    preferredLocale?: ContentLocale,
  ) => string | string[] | undefined;
  getLocalizedValueForLocale: (
    value: unknown,
    locale?: ContentLocale,
  ) => string | string[] | undefined;
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

const hasUsableLocalizedValue = (
  value: string | string[] | null | undefined,
): value is string | string[] =>
  (typeof value === "string" && value.trim().length > 0) ||
  (Array.isArray(value) && value.length > 0);

const isLocalizedTextValue = (value: unknown): value is LocalizedTextValue =>
  typeof value === "object" && value !== null;

const getLocaleFallbackOrder = (preferredLocale: ContentLocale) =>
  [preferredLocale, ...contentLocales].filter(
    (locale, index, locales) => locales.indexOf(locale) === index,
  );

function resolveLocalizedValue(
  value: unknown,
  preferredLocale: ContentLocale,
): string | string[] | undefined {
  if (typeof value === "string" || Array.isArray(value)) {
    return value;
  }

  if (!isLocalizedTextValue(value)) {
    return undefined;
  }

  for (const locale of getLocaleFallbackOrder(preferredLocale)) {
    const localizedValue = value[locale];
    if (hasUsableLocalizedValue(localizedValue)) {
      return localizedValue;
    }
  }

  return undefined;
}

function getLocalizedValueForLocale(
  value: unknown,
  locale: ContentLocale,
): string | string[] | undefined {
  if (typeof value === "string" || Array.isArray(value)) {
    return value;
  }

  if (!isLocalizedTextValue(value)) {
    return undefined;
  }

  const localizedValue = value[locale];
  return hasUsableLocalizedValue(localizedValue) ? localizedValue : undefined;
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [contentLocale, setContentLocaleState] = useState<ContentLocale>("en");

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(DASHBOARD_CONTENT_LOCALE_STORAGE_KEY);
    if (storedLocale && contentLocales.includes(storedLocale as ContentLocale)) {
      setContentLocaleState(storedLocale as ContentLocale);
    }
  }, []);

  const setContentLocale = useCallback((locale: ContentLocale) => {
    setContentLocaleState(locale);
    window.localStorage.setItem(DASHBOARD_CONTENT_LOCALE_STORAGE_KEY, locale);
  }, []);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      contentLocale,
      setContentLocale,
      resolveLocalizedValue: (localizedValue, preferredLocale = contentLocale) =>
        resolveLocalizedValue(localizedValue, preferredLocale),
      getLocalizedValueForLocale: (localizedValue, locale = contentLocale) =>
        getLocalizedValueForLocale(localizedValue, locale),
    }),
    [contentLocale, setContentLocale],
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useDashboardLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useDashboardLocalization must be used within LocalizationProvider");
  }

  return context;
}
