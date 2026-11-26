import { inArray, sql } from "drizzle-orm";

import { db as appDb, type Db } from "#src/db/client.ts";
import type { ProductSearchDocumentData } from "#src/db/json.ts";
import { productSearchDocumentTable } from "#src/db/schema.ts";
import { activeStorefrontProductWhere } from "#src/domain/storefrontVisibility.ts";
import { ObjectStorage } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { type SupportedLocale, supportedLocales } from "#src/locales.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";

import type {
  InitialSearchDataInput,
  SearchIndexInvalidationInput,
  SearchInput,
  SearchProvider,
  SearchResult,
} from "./search.provider.ts";

type RawSearchResult = {
  productId: number;
  searchData: ProductSearchDocumentData;
  score: number;
  productMatched: boolean;
  vendorFullMatched: boolean;
  vendorMatched: boolean;
  categoryFullMatched: boolean;
  categoryMatched: boolean;
};

type ProductSearchDocumentInput = {
  productId: number;
  locale: string;
  productSearchText: string;
  vendorSearchText: string;
  categorySearchText: string;
  searchData: ProductSearchDocumentData;
  searchText: string;
};

// Postgres text search configuration per locale.
const searchDictionaries: Record<string, string> = {
  en: "english",
} satisfies Record<SupportedLocale, string>;

const getPostgresSearchDictionary = (locale: string) => searchDictionaries[locale] ?? "simple";

const buildSearchText = (
  locale: string,
  parts: Array<string | string[] | Record<string, string | string[]>>,
) =>
  parts
    .flatMap((part) => {
      if (typeof part === "string") return [part];
      if (Array.isArray(part)) return part;

      const localizedValue =
        part[locale] ??
        supportedLocales.map((locale) => part[locale]).find((value) => Boolean(value));
      if (!localizedValue) return [];
      return Array.isArray(localizedValue) ? localizedValue : [localizedValue];
    })
    .filter(Boolean)
    .join(" ");

class PostgresSearchProvider implements SearchProvider {
  async search(input: SearchInput): Promise<SearchResult> {
    const { q, locale, limit = 10, offset = 0 } = input;
    const { rows: results } = await appDb.execute<RawSearchResult>(sql`
			WITH search_input AS (
				SELECT
					lower(${q}) AS normalized_query,
					0.3::real AS product_similarity_threshold,
					0.35::real AS collection_similarity_threshold
			),
			scored AS (
				SELECT
					product_id AS "productId",
					search_data AS "searchData",
					lower(product_search_text) AS product_text,
					lower(vendor_search_text) AS vendor_text,
					lower(category_search_text) AS category_text,
					similarity(lower(product_search_text), normalized_query) AS product_similarity,
					similarity(lower(vendor_search_text), normalized_query) AS vendor_similarity,
					similarity(lower(category_search_text), normalized_query) AS category_similarity,
					normalized_query,
					product_similarity_threshold,
					collection_similarity_threshold
				FROM ${productSearchDocumentTable}, search_input
				WHERE
					locale = ${locale}
			),
			matches AS (
				SELECT
					"productId",
					"searchData",
					(
						position(normalized_query in product_text) > 0
						OR product_similarity >= product_similarity_threshold
					) AS "productMatched",
					vendor_text = normalized_query AS "vendorFullMatched",
					(
						vendor_text = normalized_query
						OR starts_with(vendor_text, normalized_query)
						OR vendor_similarity >= collection_similarity_threshold
					) AS "vendorMatched",
					category_text = normalized_query AS "categoryFullMatched",
					(
						category_text = normalized_query
						OR starts_with(category_text, normalized_query)
						OR category_similarity >= collection_similarity_threshold
					) AS "categoryMatched",
					(
						product_similarity
						+ CASE WHEN starts_with(product_text, normalized_query) THEN 0.3 ELSE 0 END
						+ CASE WHEN position(normalized_query in product_text) > 0 THEN 0.2 ELSE 0 END
						+ CASE WHEN vendor_text = normalized_query THEN 0.3 ELSE 0 END
						+ CASE WHEN category_text = normalized_query THEN 0.3 ELSE 0 END
						+ CASE WHEN starts_with(vendor_text, normalized_query) THEN 0.1 ELSE 0 END
						+ CASE WHEN starts_with(category_text, normalized_query) THEN 0.1 ELSE 0 END
						+ GREATEST(vendor_similarity, category_similarity) * 0.5
					) AS score
				FROM scored
				WHERE
					position(normalized_query in product_text) > 0
					OR product_similarity >= product_similarity_threshold
					OR vendor_text = normalized_query
					OR starts_with(vendor_text, normalized_query)
					OR vendor_similarity >= collection_similarity_threshold
					OR category_text = normalized_query
					OR starts_with(category_text, normalized_query)
					OR category_similarity >= collection_similarity_threshold
			)
      SELECT
        "productId",
        "searchData",
				"productMatched",
				"vendorFullMatched",
				"vendorMatched",
				"categoryFullMatched",
				"categoryMatched",
        score
      FROM matches
      ORDER BY ("productMatched" OR "vendorFullMatched" OR "categoryFullMatched") DESC, score DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);
    const productResults = results.filter(
      (result) => result.productMatched || result.vendorFullMatched || result.categoryFullMatched,
    );
    const vendors = [
      ...new Map(
        results
          .filter((result) => result.vendorMatched)
          .map((result) => [result.searchData.vendor.id, result.searchData.vendor]),
      ).values(),
    ];
    const categoryMap = new Map<number, NonNullable<RawSearchResult["searchData"]["category"]>>();
    for (const result of results) {
      if (!result.categoryMatched || !result.searchData.category) continue;

      categoryMap.set(result.searchData.category.id, result.searchData.category);
    }

    return {
      total: productResults.length,
      results: {
        products: productResults.map((result) => result.searchData.product),
        vendors,
        categories: [...categoryMap.values()],
      },
    };
  }

  async getInitialData(input: InitialSearchDataInput): Promise<SearchResult> {
    const { locale, limit = 10 } = input;
    const featuredLimit = Math.min(5, limit);
    const { rows: documents } = await appDb.execute<{
      searchData: ProductSearchDocumentData;
    }>(sql`
			WITH featured AS (
				SELECT
					product_id,
					search_data AS "searchData",
					(search_data #>> '{ranking,createdAt}')::timestamptz AS created_at,
					0 AS group_order
				FROM ${productSearchDocumentTable}
				WHERE
					locale = ${locale}
					AND (search_data #>> '{ranking,isFeatured}')::boolean = true
					AND (search_data #>> '{product,outOfStock}')::boolean = false
				ORDER BY created_at DESC, product_id DESC
				LIMIT ${featuredLimit}
			),
			latest AS (
				SELECT
					product_id,
					search_data AS "searchData",
					(search_data #>> '{ranking,createdAt}')::timestamptz AS created_at,
					1 AS group_order
				FROM ${productSearchDocumentTable}
				WHERE
					locale = ${locale}
					AND (search_data #>> '{product,outOfStock}')::boolean = false
					AND product_id NOT IN (SELECT product_id FROM featured)
				ORDER BY created_at DESC, product_id DESC
				LIMIT ${limit}
			)
			SELECT "searchData"
			FROM (
				SELECT * FROM featured
				UNION ALL
				SELECT * FROM latest
			) initial_results
			ORDER BY group_order ASC, created_at DESC, product_id DESC
			LIMIT ${limit}
		`);
    const products = documents.map((document) => document.searchData.product);

    return {
      total: products.length,
      results: {
        products,
        vendors: [],
        categories: [],
      },
    };
  }

  async invalidateIndex(input: SearchIndexInvalidationInput): Promise<void> {
    const { productIds } = input;

    if (productIds.length === 0) {
      return;
    }

    await appDb.transaction(async (tx) => {
      const documents = await this.buildProductDocuments({ productIds }, tx);

      await this.upsertDocuments(documents, tx);

      const indexedProductIds = new Set(documents.map((document) => document.productId));

      // If the requested product IDs include products that are no longer
      // present in the product table or are in the status that indicates
      // they're not visible to customers, they should be removed from the search index
      // to avoid search results showing products that can't be interacted with.
      // while this approach is not as efficient as asking the caller to provide
      // deleted and upserted product IDs separately, it ensures that the search
      // index remains consistent with the product table and that the caller
      // doesn't have to separately handle status changes or deletions of products,
      // and can instead just provide affected product IDs and let the search provider handle the rest.
      const notIndexedProductIds = productIds.filter(
        (productId) => !indexedProductIds.has(productId),
      );

      if (notIndexedProductIds.length > 0) {
        await tx
          .delete(productSearchDocumentTable)
          .where(inArray(productSearchDocumentTable.productId, notIndexedProductIds));
      }
    });
  }

  private async buildProductDocuments(
    input: { productIds?: number[] },
    db: Db = appDb,
  ): Promise<ProductSearchDocumentInput[]> {
    const products = await db.query.product.findMany({
      where: {
        ...activeStorefrontProductWhere({ productIds: input.productIds }),
      },
      columns: {
        id: true,
        name: true,
        slug: true,
        salesPriceCents: true,
        currentStock: true,
        reservedStock: true,
        isFeatured: true,
        createdAt: true,
      },
      with: {
        images: FIRST_LINKED_IMAGE_SELECT,
        vendor: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
          with: { images: FIRST_LINKED_IMAGE_SELECT },
        },
        category: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
          with: {
            image: {
              columns: {
                storageKey: true,
              },
            },
          },
        },
        tags: {
          columns: {},
          with: {
            tag: {
              columns: {
                name: true,
              },
            },
          },
        },
      },
    });

    return products.flatMap((product) =>
      supportedLocales.map((locale) => {
        const productSearchText = buildSearchText(locale, [
          product.name,
          ...product.tags.map(({ tag }) => tag.name),
        ]);
        const vendorSearchText = product.vendor.name;
        const categorySearchText = product.category
          ? buildSearchText(locale, [product.category.name])
          : "";

        return {
          productId: product.id,
          locale,
          productSearchText,
          vendorSearchText,
          categorySearchText,
          searchData: {
            product: {
              id: product.id,
              name: buildSearchText(locale, [product.name]),
              slug: buildSearchText(locale, [product.slug]),
              imageUrl: getFirstLinkedImageUrl(ObjectStorage, product.images),
              priceCents: product.salesPriceCents,
              outOfStock: product.currentStock - product.reservedStock <= 0,
            },
            vendor: {
              id: product.vendor.id,
              name: product.vendor.name,
              slug: product.vendor.slug,
              imageUrl: getFirstLinkedImageUrl(ObjectStorage, product.vendor.images),
            },
            category: product.category
              ? {
                  id: product.category.id,
                  name: categorySearchText,
                  slug: buildSearchText(locale, [product.category.slug]),
                  imageUrl: ObjectStorage.getPublicUrl(product.category.image.storageKey),
                }
              : null,
            ranking: {
              isFeatured: product.isFeatured,
              createdAt: product.createdAt,
            },
          },
          searchText: buildSearchText(locale, [
            productSearchText,
            vendorSearchText,
            categorySearchText,
          ]),
        };
      }),
    );
  }

  private async upsertDocuments(documents: ProductSearchDocumentInput[], db: Db = appDb) {
    const filteredDocuments = documents.filter((document) => document.searchText.trim() !== "");
    if (filteredDocuments.length === 0) return;

    const values = sql.join(
      filteredDocuments.map(
        (document) => sql`(
					${document.productId},
					${document.locale},
					${document.productSearchText},
					${document.vendorSearchText},
					${document.categorySearchText},
					${document.searchData},
					to_tsvector(
            ${getPostgresSearchDictionary(document.locale)},
            ${document.searchText}
          )
				)`,
      ),
      sql`, `,
    );

    await db.execute(sql`
			INSERT INTO ${productSearchDocumentTable} (
				product_id,
				locale,
				product_search_text,
				vendor_search_text,
				category_search_text,
				search_data,
				search_vector
			)
			VALUES ${values}
			ON CONFLICT (product_id, locale) DO UPDATE SET
				product_search_text = EXCLUDED.product_search_text,
				vendor_search_text = EXCLUDED.vendor_search_text,
				category_search_text = EXCLUDED.category_search_text,
				search_data = EXCLUDED.search_data,
				search_vector = EXCLUDED.search_vector
		`);
  }
}

export default new PostgresSearchProvider();
