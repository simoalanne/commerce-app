import { RouteError } from "@rest-rpc/server";
import z from "zod";

import type { Db } from "#src/db/client.ts";
import { activeStorefrontProductWhere } from "#src/domain/storefrontVisibility.ts";
import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
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
    orderBy: { tag_id: "asc" },
    columns: {},
    with: { tag: { columns: { name: true, color: true } } },
  },
  reviews: {
    where: { kind: "PRODUCT" },
    columns: { rating: true },
  },
} as const;

const findProduct = (db: Db, id: number) =>
  db.query.product.findFirst({
    where: activeStorefrontProductWhere({ productId: id }),
    with: { ...productWith, images: ALL_LINKED_IMAGES_SELECT },
  });

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof findProduct>>>;

const getProductReviewSummary = (product: ProductWithRelations) => {
  if (product.reviews.length === 0) {
    return {
      avgRating: 0,
      reviewCount: 0,
    };
  }

  const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    avgRating: Number((totalRating / product.reviews.length).toFixed(1)),
    reviewCount: product.reviews.length,
  };
};

const toProductSummary = (storage: ObjectStorageProvider, product: ProductWithRelations) => ({
  id: product.id,
  slug: product.slug,
  sku: product.sku,
  name: product.name,
  headline: product.headline,
  category: product.category?.name ?? null,
  vendorName: product.vendor?.name || "Tuntematon",
  tags: product.tags.map((productTag) => productTag.tag),
  imageUrl: getFirstLinkedImageUrl(storage, product.images),
  priceCents: product.sales_price_cents,
  availableStock: product.current_stock - product.reserved_stock,
  purchaseLimitPerOrder: product.purchase_limit_per_order,
  isOutOfStock: product.current_stock - product.reserved_stock <= 0,
  isFeatured: product.is_featured,
  ...getProductReviewSummary(product),
});

export const productsRoutes = {
  getById: customerRoute
    .get("/products/:id")
    .params(z.object({ id: z.coerce.number<number>().int().positive() }))
    .handler(async ({ params, context }) => {
      const product = await findProduct(context.db, params.id);
      if (!product) throw new RouteError("NOT_FOUND", { status: 404 });

      return toResponse(
        {
          ...toProductSummary(context.storage, product),
          fullDescription: product.full_description,
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

      return toResponse(
        products.map((product) => toProductSummary(context.storage, product)),
        context.locale,
      );
    }),
};
