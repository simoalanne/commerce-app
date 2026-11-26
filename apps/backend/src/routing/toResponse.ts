import { type SupportedLocale, supportedLocales } from "#src/locales.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type LocalizedValue<T> = T[keyof T] extends string[] | undefined
  ? string[]
  : T[keyof T] extends string | undefined
    ? string
    : Jsonified<NonNullable<T[keyof T]>>;

/**
 * What JSON delivers for a handler value: Date as an ISO `string`, and, when
 * `TLocalize` is true, objects keyed exactly by `SupportedLocale`
 * (`LocalizedString`, `LocalizedStringArray`, or
 * records of localized objects such as CMS blocks) as the value for the
 * requested locale.
 */
export type Jsonified<T, TLocalize extends boolean = true> = T extends Date
  ? string
  : T extends string | number | boolean | null | undefined
    ? T
    : T extends readonly (infer U)[]
      ? Jsonified<U, TLocalize>[]
      : T extends object
        ? TLocalize extends true
          ? Equal<keyof T, SupportedLocale> extends true
            ? LocalizedValue<T>
            : { [K in keyof T]: Jsonified<T[K], TLocalize> }
          : { [K in keyof T]: Jsonified<T[K], TLocalize> }
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
    if (isPlainObject(localized)) return convert(localized, locale);
  }
  return Object.values(value).some(Array.isArray) ? [] : "";
};

const convert = (value: unknown, locale?: SupportedLocale): unknown => {
  if (Array.isArray(value)) return value.map((item) => convert(item, locale));
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object" || value === null) return value;
  if (!isPlainObject(value)) return value;
  if (locale && isLocalizedObject(value)) return localize(value, locale);

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, convert(item, locale)]),
  );
};

/**
 * Converts a handler value to what JSON delivers, and types it so. Without a
 * locale, localized objects are kept as they are.
 */
export function toResponse<T>(value: T, locale: SupportedLocale): Jsonified<T>;
export function toResponse<T>(value: T): Jsonified<T, false>;
export function toResponse(value: unknown, locale?: SupportedLocale) {
  return convert(value, locale);
}
