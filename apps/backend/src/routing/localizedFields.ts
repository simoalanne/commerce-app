import { type SupportedLocale, supportedLocales } from "#src/locales.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type LocalizedValue<T> = T[keyof T] extends string[] | undefined
  ? string[]
  : T[keyof T] extends string | undefined
    ? string
    : Localized<NonNullable<T[keyof T]>>;

/**
 * A value with each object keyed exactly by `SupportedLocale`
 * (`LocalizedString`, `LocalizedStringArray`, or records of localized objects
 * such as CMS blocks) replaced by its value for one locale.
 */
type Localized<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly (infer U)[]
    ? Localized<U>[]
    : T extends object
      ? Equal<keyof T, SupportedLocale> extends true
        ? LocalizedValue<T>
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

const hasUsableLocalizedValue = (value: unknown): value is string | string[] =>
  (typeof value === "string" && value.trim().length > 0) ||
  (Array.isArray(value) && value.length > 0);

// The requested locale first, then the supported locales in order. When no
// locale has a usable value, an empty value of the stored kind.
const localize = (value: Record<string, unknown>, locale: SupportedLocale) => {
  const candidates = [locale, ...supportedLocales.filter((l) => l !== locale)];
  for (const candidate of candidates) {
    const localized = value[candidate];
    if (hasUsableLocalizedValue(localized)) return localized;
    if (isPlainObject(localized)) return resolve(localized, locale);
  }
  return Object.values(value).some(Array.isArray) ? [] : "";
};

const resolve = (value: unknown, locale: SupportedLocale): unknown => {
  if (Array.isArray(value)) return value.map((item) => resolve(item, locale));
  if (!isPlainObject(value)) return value;
  if (isLocalizedObject(value)) return localize(value, locale);

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
