import { slugify } from "@acme/shared";

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
