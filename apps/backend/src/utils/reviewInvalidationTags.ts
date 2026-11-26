import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { reviewsRoutes as customerReviewsRoutes } from "#src/features/customer-api/reviews/reviews.routes.ts";
import { vendorsRoutes as customerVendorsRoutes } from "#src/features/customer-api/vendors/vendors.routes.ts";

import { buildTag } from "./buildTags.ts";

type ReviewInvalidationTarget = {
  kind: string;
  productId?: number | null;
  vendorId?: number | null;
};

export const buildReviewInvalidationTags = (reviews: ReviewInvalidationTarget[]) => [
  ...new Set([
    buildTag(customerReviewsRoutes.list),
    ...reviews.flatMap((review) => {
      if (review.kind === "PRODUCT" && review.productId != null) {
        return [
          buildTag(customerReviewsRoutes.getByProduct, review.productId),
          // Product list/detail responses include review aggregates.
          buildTag(customerProductsRoutes.getAll),
          buildTag(customerProductsRoutes.getById, review.productId),
        ];
      }

      if (review.kind === "VENDOR" && review.vendorId != null) {
        return [
          buildTag(customerVendorsRoutes.getReviews, review.vendorId),
          // Vendor list/detail responses include review aggregates.
          buildTag(customerVendorsRoutes.getAll),
          buildTag(customerVendorsRoutes.getById, review.vendorId),
        ];
      }

      return [];
    }),
  ]),
];
