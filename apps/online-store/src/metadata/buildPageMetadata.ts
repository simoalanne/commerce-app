import "server-only";
import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

import { storefrontMetadataAssets } from "./storefrontMetadataAssets";

export type BuildPageMetadataOptions = {
  locale: string;
  title: string;
  description: string;
  pathname: `/${string}`;
  imageUrl?: string;
  fallbackImageUrl?: string;
};

/**
 * Builds route metadata for a public localized page.
 *
 * @param title: The title of the page, used in the HTML title tag and Open Graph metadata.
 * @param description: A brief description of the page, used in the meta description tag and Open Graph metadata.
 * @param pathname: The path of the page relative to the locale root (e.g., "/products"). Locale is prefixed automatically based on the current locale.
 * @param imageUrl: An optional URL to an image representing the page, used in Open Graph and Twitter metadata.
 * Uses the global metadataBase from site metadata to resolve the returned relative URLs.
 * Does not normalize or correct the pathname.
 */
export async function buildPageMetadata(options: BuildPageMetadataOptions): Promise<Metadata> {
  const locale = options.locale;
  const buildLocalizedPath = (targetLocale: string) =>
    options.pathname === "/" ? `/${targetLocale}` : `/${targetLocale}${options.pathname}`;
  const canonicalPath = buildLocalizedPath(locale);
  const languageAlternates = Object.fromEntries(
    routing.locales.map((targetLocale) => [targetLocale, buildLocalizedPath(targetLocale)]),
  );
  const resolvedImageUrl =
    options.imageUrl ??
    options.fallbackImageUrl ??
    storefrontMetadataAssets.defaultSocialShareImageUrl;
  const images = resolvedImageUrl ? [{ url: resolvedImageUrl, width: 1200, height: 630 }] : [];

  return {
    title: options.title,
    description: options.description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        ...languageAlternates,
        "x-default": buildLocalizedPath(routing.defaultLocale),
      },
    },
    openGraph: {
      title: options.title,
      description: options.description,
      url: canonicalPath,
      images,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: resolvedImageUrl ? [resolvedImageUrl] : [],
    },
  };
}
