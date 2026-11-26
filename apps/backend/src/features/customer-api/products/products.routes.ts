import { RouteError } from "@rest-rpc/server";
import z from "zod";

import type { Db } from "#src/db/client.ts";
import { activeStorefrontProductWhere } from "#src/domain/storefrontVisibility.ts";
import {
  getReviewSummaryMap,
  type ReviewSummary,
} from "#src/features/customer-api/reviews/reviews.utils.ts";
import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { customerRoute } from "#src/routing/base.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";
import {
  ALL_LINKED_IMAGES_SELECT,
  FIRST_LINKED_IMAGE_SELECT,
  getFirstLinkedImageUrl,
  getLinkedImageUrls,
} from "#src/utils/imageUrl.ts";

const productWith = {
  vendor: { columns: { name: true } },
  category: { columns: { name: true } },
  tags: {
    orderBy: { tagId: "asc" },
    columns: {},
    with: { tag: { columns: { name: true, color: true } } },
  },
} as const;

const findProduct = (db: Db, id: number) =>
  db.query.product.findFirst({
    where: activeStorefrontProductWhere({ productId: id }),
    with: { ...productWith, images: ALL_LINKED_IMAGES_SELECT },
  });

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof findProduct>>>;

const toProductSummary = (
  storage: ObjectStorageProvider,
  product: ProductWithRelations,
  reviewSummary: ReviewSummary | undefined,
) => ({
  id: product.id,
  slug: product.slug,
  sku: product.sku,
  name: product.name,
  headline: product.headline,
  category: product.category?.name ?? null,
  vendorName: product.vendor.name,
  tags: product.tags.map((productTag) => productTag.tag),
  imageUrl: getFirstLinkedImageUrl(storage, product.images),
  priceCents: product.salesPriceCents,
  availableStock: product.currentStock - product.reservedStock,
  purchaseLimitPerOrder: product.purchaseLimitPerOrder,
  isOutOfStock: product.currentStock - product.reservedStock <= 0,
  isFeatured: product.isFeatured,
  avgRating: reviewSummary?.avgRating ?? 0,
  reviewCount: reviewSummary?.reviewCount ?? 0,
});

export const productsRoutes = {
  getById: customerRoute
    .get("/products/:id")
    .params(z.object({ id: z.coerce.number<number>().int().positive() }))
    .handler(async ({ params, context }) => {
      const product = await findProduct(context.db, params.id);
      if (!product) throw new RouteError("NOT_FOUND", { status: 404 });
      const reviewSummaries = await getReviewSummaryMap(context.db, "PRODUCT", [product.id]);

      return resolveLocalizedFields(
        {
          ...toProductSummary(context.storage, product, reviewSummaries.get(product.id)),
          fullDescription: product.fullDescription,
          imageUrls: getLinkedImageUrls(context.storage, product.images),
        },
        context.locale,
      );
    }),

  getAll: customerRoute
    .get("/products/")
    .query(
      z.object({
        vendorId: z.coerce.number<number>().int().positive().optional(),
        categoryId: z.coerce.number<number>().int().positive().optional(),
      }),
    )
    .handler(async ({ query, context }) => {
      const products = await context.db.query.product.findMany({
        where: activeStorefrontProductWhere({
          categoryId: query.categoryId,
          vendorId: query.vendorId,
        }),
        with: { ...productWith, images: FIRST_LINKED_IMAGE_SELECT },
      });
      const reviewSummaries = await getReviewSummaryMap(
        context.db,
        "PRODUCT",
        products.map((product) => product.id),
      );

      return resolveLocalizedFields(
        products.map((product) =>
          toProductSummary(context.storage, product, reviewSummaries.get(product.id)),
        ),
        context.locale,
      );
    }),
};
