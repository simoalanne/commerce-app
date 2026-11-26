import type { LocalizedString, LocalizedStringArray } from "#src/db/json.ts";
import { type SupportedLocale, supportedLocales } from "#src/locales.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * A value with each object keyed exactly by `SupportedLocale`
 * (`LocalizedString` or `LocalizedStringArray`) replaced by its value for one
 * locale.
 */
type Localized<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly (infer U)[]
    ? Localized<U>[]
    : T extends object
      ? Equal<keyof T, SupportedLocale> extends true
        ? T[keyof T] extends string[] | undefined
          ? string[]
          : string
        : { [K in keyof T]: Localized<T[K]> }
      : T;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const isSupportedLocale = (key: string): key is SupportedLocale =>
  (supportedLocales as readonly string[]).includes(key);

const isLocalizedObject = (value: Record<string, unknown>) => {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(isSupportedLocale);
};

const hasUsableValue = <T extends string | string[]>(value: T | undefined): value is T =>
  (typeof value === "string" && value.trim().length > 0) ||
  (Array.isArray(value) && value.length > 0);

/**
 * The value for `locale`, falling back to the supported locales in order.
 * `undefined` when no locale has a usable value.
 */
export const localize = <T extends string | string[]>(
  value: Partial<Record<SupportedLocale, T>>,
  // Wider than SupportedLocale because stored locale preferences are plain text.
  locale: string,
) =>
  [locale, ...supportedLocales]
    // An unsupported locale just finds no value.
    .map((candidate) => value[candidate as SupportedLocale])
    .find(hasUsableValue);

const resolve = (value: unknown, locale: SupportedLocale): unknown => {
  if (Array.isArray(value)) return value.map((item) => resolve(item, locale));
  if (!isPlainObject(value)) return value;
  if (isLocalizedObject(value)) {
    // Only the localized column types are keyed by locale.
    const localized = value as LocalizedString | LocalizedStringArray;
    const empty = Object.values(localized).some(Array.isArray) ? [] : "";
    return localize<string | string[]>(localized, locale) ?? empty;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, resolve(item, locale)]),
  );
};

/**
 * Replaces the localized fields in a response value with their value for
 * `locale`. Only for values that have localized fields: a value without any
 * fails to typecheck (the rest parameter then requires an argument).
 */
export const resolveLocalizedFields = <T>(
  value: T,
  locale: SupportedLocale,
  ..._hasLocalizedFields: Equal<Localized<T>, T> extends true ? [never] : []
) => resolve(value, locale) as Localized<T>;
