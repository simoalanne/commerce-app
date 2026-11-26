import type { MetadataRoute } from "next";

import { createCustomerClient } from "@/api/client";
import { legalDocumentConfigs } from "@/features/legal-documents/legalDocumentConfig";
import { type AppLocale, routing } from "@/i18n/routing";
import type { LegalDocument } from "@/server/getLegalDocumentByKey";
import { nextCache, timeout } from "@/server/serverApiClient";
import type { StorefrontContext } from "@/types/api";

const { locales } = routing;
type Locale = AppLocale;
type SitemapEntry = MetadataRoute.Sitemap[number];
type LocalizedStorefrontContext = StorefrontContext & { locale: Locale };
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

const createAlternates = (languages: Record<string, string>) => ({
  languages,
});

// Not createServerSideApiClient: the sitemap has no route params and caches
// for a day instead of 15 minutes.
function createSitemapApiClient(locale?: Locale) {
  return createCustomerClient({
    interceptors: [timeout(10_000), nextCache(24 * 60 * 60)],
    globalHeaders: {
      "accept-language": locale,
      "x-acme-client": "online-store-sitemap",
    },
  });
}

async function loadSitemapData() {
  const api = createSitemapApiClient();
  const legalDocuments = await Promise.all(
    legalDocumentConfigs.map(async (document) => {
      const { body } = await api.legalDocuments.getByKey({
        params: { key: document.key },
      });
      return body;
    }),
  );

  const localizedContexts = await Promise.all(
    locales.map(async (locale) => {
      const { body: context } = await createSitemapApiClient(locale).storefront.getContext();

      return { locale, ...context };
    }),
  );

  return { legalDocuments, localizedContexts };
}

function createStaticEntries(base: string): SitemapEntry[] {
  const paths = ["", "/contact"];

  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      alternates: createAlternates(
        Object.fromEntries(locales.map((altLocale) => [altLocale, `${base}/${altLocale}${path}`])),
      ),
    })),
  );
}

function createLegalDocumentEntries(base: string, legalDocuments: LegalDocument[]): SitemapEntry[] {
  return legalDocumentConfigs.flatMap((documentConfig) => {
    const document = legalDocuments.find((candidate) => candidate.key === documentConfig.key);

    if (!document) {
      throw new Error(`Missing legal document ${documentConfig.key}`);
    }

    return locales.map((locale) => ({
      url: `${base}/${locale}${documentConfig.pathname}`,
      lastModified: document.updatedAt,
      alternates: createAlternates(
        Object.fromEntries(
          locales.map((altLocale) => [altLocale, `${base}/${altLocale}${documentConfig.pathname}`]),
        ),
      ),
    }));
  });
}

const latestUpdate = (items: Array<{ updatedAt: string }>) =>
  items.reduce<string | undefined>(
    (latest, item) => (!latest || item.updatedAt > latest ? item.updatedAt : latest),
    undefined,
  );

function createCatalogEntries(
  base: string,
  context: LocalizedStorefrontContext,
  localizedContexts: LocalizedStorefrontContext[],
): SitemapEntry[] {
  const { locale, vendors, products } = context;

  const sitemapEntries: SitemapEntry[] = [];

  // 1. Vendor collection route.
  sitemapEntries.push({
    url: `${base}/${locale}/vendors`,
    lastModified: latestUpdate(vendors),
    alternates: createAlternates(
      Object.fromEntries(locales.map((altLocale) => [altLocale, `${base}/${altLocale}/vendors`])),
    ),
  });

  // 2. products collection route.
  sitemapEntries.push({
    url: `${base}/${locale}/products`,
    lastModified: latestUpdate(products),
    alternates: createAlternates(
      Object.fromEntries(locales.map((altLocale) => [altLocale, `${base}/${altLocale}/products`])),
    ),
  });

  // 3. individual vendor routes.
  vendors.forEach((vendor) => {
    sitemapEntries.push({
      url: `${base}/${locale}/vendors/${vendor.slug}`,
      lastModified: vendor.updatedAt,
      images: [vendor.imageUrl],
      alternates: createAlternates(
        Object.fromEntries(
          locales.map((altLocale) => [altLocale, `${base}/${altLocale}/vendors/${vendor.slug}`]),
        ),
      ),
    });
  });

  // 4. individual product routes.
  products.forEach((product) => {
    sitemapEntries.push({
      url: `${base}/${locale}/products/${product.slug}`,
      lastModified: product.updatedAt,
      images: [product.imageUrl],
      alternates: createAlternates(
        Object.fromEntries(
          locales.map((altLocale) => {
            const alternateProduct = localizedContexts
              .find((candidate) => candidate.locale === altLocale)
              ?.products.find((candidate) => candidate.id === product.id);

            if (!alternateProduct) {
              throw new Error(
                `Missing localized product route for product ${product.id} in ${altLocale}`,
              );
            }

            return [altLocale, `${base}/${altLocale}/products/${alternateProduct.slug}`];
          }),
        ),
      ),
    });
  });

  return sitemapEntries;
}

/**
 * Builds the full storefront sitemap from lightweight customer API list/context data.
 *
 * This intentionally favors a readable implementation over pre-indexed lookup
 * structures. Sitemap generation is not hot-path UI code, and the data volume is
 * expected to stay modest enough that local `find` calls are acceptable.
 *
 * Current route assumptions:
 * - Every public vendor and product route has an alternate in every
 *   configured locale. Missing product alternates throws because that would break
 *   the current SEO model rather than represent an optional route.
 * - Vendor slugs are treated as stable across locales. Product slugs
 *   are localized, so product alternates are matched by product id across the
 *   already-loaded localized storefront contexts.
 * - Legal document routes are backed by CMS records, so their `updatedAt` is used
 *   as `lastModified`. Other static marketing routes do not currently have a
 *   reliable content timestamp as they are not backed by CMS records, so they are emitted without `lastModified`.
 * - Image sitemap hints are emitted only from data already available in the
 *   sitemap inputs: vendor images and product
 *   images. The implementation does not do extra per-route fetches just to enrich
 *   sitemap metadata.
 * - Advanced sitemap features like `changefreq` and `priority` are not currently used, since they are not mandatory
 *   to specify and using guessed values will hurt SEO more than leaving them out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  if (!base) return [];

  const { legalDocuments, localizedContexts } = await loadSitemapData();

  return [
    ...createStaticEntries(base),
    ...createLegalDocumentEntries(base, legalDocuments),
    ...localizedContexts.flatMap((context) =>
      createCatalogEntries(base, context, localizedContexts),
    ),
  ];
}
