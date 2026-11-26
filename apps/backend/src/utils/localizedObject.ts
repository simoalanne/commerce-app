import { slugify } from "@acme/shared";

import { supportedLocales } from "#src/locales.ts";

type LocalizedValue<TValue extends string | string[]> = TValue extends string[]
  ? Record<string, string[]>
  : Record<string, string>;
// A missing value clears the column.
type LocalizedOrNull<TValue> = TValue extends string | string[] ? LocalizedValue<TValue> : null;

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toLocalizedString = <TValue extends string | string[] | null | undefined>(
  value: TValue,
  locale: string,
) => (value == null ? null : { [locale]: value }) as LocalizedOrNull<TValue>;

export const mergeLocalizedString = <TValue extends string | string[] | null | undefined>(
  existingValue: unknown,
  value: TValue,
  locale: string,
) =>
  (value == null
    ? null
    : {
        ...(isJsonObject(existingValue) ? existingValue : {}),
        [locale]: value,
      }) as LocalizedOrNull<TValue>;

export const toLocalizedSlug = <TValue extends string>(
  value: TValue,
  locale: string,
): LocalizedValue<TValue> => ({ [locale]: slugify(value) }) as LocalizedValue<TValue>;

export const mergeLocalizedSlug = <TValue extends string>(
  existingValue: unknown,
  value: TValue,
  locale: string,
): LocalizedValue<TValue> =>
  mergeLocalizedString(existingValue, slugify(value), locale) as LocalizedValue<TValue>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const hasUsableLocalizedValue = (value: unknown): value is string | string[] =>
  (typeof value === "string" && value.trim().length > 0) ||
  (Array.isArray(value) && value.length > 0);

const localeFallbackOrder = (locale?: string) =>
  [locale, ...supportedLocales].filter(
    (candidate, index, array): candidate is string =>
      typeof candidate === "string" && array.indexOf(candidate) === index,
  );

export const getLocalizedValue = (
  value: Record<string, unknown> | undefined,
  locale?: string,
): string | string[] | Record<string, unknown> | unknown => {
  if (!value || !isPlainObject(value)) {
    return value;
  }

  const hasLocaleKeys = localeFallbackOrder(locale).some(
    (candidateLocale) => candidateLocale in value,
  );

  if (!hasLocaleKeys) {
    return value;
  }

  let hasArray = false;
  let hasString = false;

  for (const candidateLocale of localeFallbackOrder(locale)) {
    const localizedValue = value[candidateLocale];

    if (hasUsableLocalizedValue(localizedValue)) {
      return localizedValue;
    }

    if (Array.isArray(localizedValue)) hasArray = true;
    if (typeof localizedValue === "string") hasString = true;

    if (isPlainObject(localizedValue)) {
      return localizedValue;
    }
  }

  if (hasArray) return [];
  if (hasString) return "";

  return value;
};
