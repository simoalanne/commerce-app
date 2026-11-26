import { slugify } from "@acme/shared";
import type { Prisma } from "@prisma/client";
import { JsonNull as RuntimeJsonNull } from "@prisma/client/runtime/client";

import { supportedLocales } from "#src/locales.ts";

type LocalizedValue<TValue extends string | string[]> = TValue extends string[]
  ? Record<string, string[]>
  : Record<string, string>;
type JsonNull = typeof Prisma.JsonNull;

// The same instance as Prisma.JsonNull without needing the generated client at
// runtime. The generated client declares its own class type, hence the cast.
const jsonNull = RuntimeJsonNull as unknown as JsonNull;

const isJsonObject = (value: Prisma.JsonValue | null): value is Prisma.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getLocalizedObject = <TValue extends string | string[]>(
  value: Prisma.JsonValue | null,
): LocalizedValue<TValue> => (isJsonObject(value) ? value : {}) as LocalizedValue<TValue>;

export const toLocalizedString = <TValue extends string | string[] | null | undefined>(
  value: TValue,
  locale: string,
): TValue extends string | string[] ? LocalizedValue<TValue> : JsonNull => {
  if (value == null) {
    return jsonNull as TValue extends string | string[] ? LocalizedValue<TValue> : JsonNull;
  }

  return { [locale]: value } as TValue extends string | string[]
    ? LocalizedValue<TValue>
    : JsonNull;
};

export const mergeLocalizedString = <TValue extends string | string[] | null | undefined>(
  existingValue: Prisma.JsonValue | null,
  value: TValue,
  locale: string,
): TValue extends string | string[] ? LocalizedValue<TValue> : JsonNull => {
  if (value == null) {
    return jsonNull as TValue extends string | string[] ? LocalizedValue<TValue> : JsonNull;
  }

  return {
    ...getLocalizedObject<Extract<TValue, string | string[]>>(existingValue),
    [locale]: value,
  } as TValue extends string | string[] ? LocalizedValue<TValue> : JsonNull;
};

export const toLocalizedSlug = <TValue extends string>(
  value: TValue,
  locale: string,
): LocalizedValue<TValue> => ({ [locale]: slugify(value) }) as LocalizedValue<TValue>;

export const mergeLocalizedSlug = <TValue extends string>(
  existingValue: Prisma.JsonValue | null,
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
