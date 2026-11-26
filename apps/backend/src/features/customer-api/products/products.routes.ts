import type { Prisma } from "@prisma/client";
import z from "zod";

import { activeStorefrontProductWhere } from "#src/domain/storefrontVisibility.ts";
import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import {
  ALL_LINKED_IMAGES_SELECT,
  FIRST_LINKED_IMAGE_SELECT,
  getFirstLinkedImageUrl,
  getLinkedImageUrls,
  type IMAGE_LINK_WITH_STORAGE_KEY_SELECT,
} from "#src/utils/imageUrl.ts";

const productInclude = {
  vendor: { select: { name: true } },
  category: { select: { name: true } },
  tags: {
    orderBy: { tag_id: "asc" },
    select: { tag: { select: { name: true, color: true } } },
  },
  reviews: {
    where: { kind: "PRODUCT" },
    select: { rating: true },
  },
} as const;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude & {
    images: { select: typeof IMAGE_LINK_WITH_STORAGE_KEY_SELECT };
  };
}>;

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
  price: Number(product.sales_price),
  pricePerKg: product.weight_grams
    ? Number((Number(product.sales_price) / (product.weight_grams / 1000)).toFixed(2))
    : undefined,
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
      const product = await context.db.product.findFirstOrThrow({
        where: activeStorefrontProductWhere({ productId: params.id }),
        include: { ...productInclude, images: ALL_LINKED_IMAGES_SELECT },
      });

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
      const products = await context.db.product.findMany({
        where: activeStorefrontProductWhere({
          categoryId: query.categoryId,
          vendorId: query.vendorId,
        }),
        include: { ...productInclude, images: FIRST_LINKED_IMAGE_SELECT },
      });

      return toResponse(
        products.map((product) => toProductSummary(context.storage, product)),
        context.locale,
      );
    }),
};
