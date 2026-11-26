import { slugify } from "@acme/shared";

import type { LocalizedString } from "#src/db/json.ts";

export type LocalizedSlug = LocalizedString;

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const buildLocalizedSlug = (value: string, locale: string) =>
  ({
    [locale]: slugify(value),
  }) as LocalizedSlug;

export const buildLocalizedSlugFromLocalizedText = (value: LocalizedString): LocalizedSlug => {
  const result: Record<string, string> = {};

  for (const [locale, localizedValue] of Object.entries(value)) {
    if (isNonEmptyString(localizedValue)) {
      result[locale] = slugify(localizedValue);
    }
  }

  return result;
};

export const getLocalizedSlugForLocale = (
  value: Record<string, unknown>,
  locale: string,
): string | null => {
  const localizedValue = value[locale];
  return isNonEmptyString(localizedValue) ? localizedValue : null;
};

export const getAllLocalizedSlugValues = (value: Record<string, unknown>): string[] => {
  const values = Object.values(value).filter(isNonEmptyString);

  return [...new Set(values)];
};

export const matchesLocalizedSlug = (value: unknown, requestedSlug: string): boolean => {
  if (!isObjectLike(value)) {
    return false;
  }

  return getAllLocalizedSlugValues(value).includes(requestedSlug);
};

export const getCanonicalLocalizedSlug = (value: unknown, locale: string): string | null => {
  if (!isObjectLike(value)) {
    return null;
  }

  return getLocalizedSlugForLocale(value, locale);
};

export const hasExactLocalizedSlugForLocale = (value: unknown, locale: string): boolean => {
  if (!isObjectLike(value)) {
    return false;
  }

  return typeof value[locale] === "string" && value[locale].trim().length > 0;
};

export const hasSlugCollision = (
  currentSlug: LocalizedSlug,
  existingSlugs: Array<{ id: number; slug: unknown }>,
  ignoreId?: number,
) => {
  const currentValues = new Set(getAllLocalizedSlugValues(currentSlug));

  return existingSlugs.some((entity) => {
    if (ignoreId != null && entity.id === ignoreId) {
      return false;
    }

    if (!isObjectLike(entity.slug)) {
      return false;
    }

    return getAllLocalizedSlugValues(entity.slug).some((value) => currentValues.has(value));
  });
};
