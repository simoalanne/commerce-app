import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { reviewsRoutes as customerReviewsRoutes } from "#src/features/customer-api/reviews/reviews.routes.ts";
import { vendorsRoutes as customerVendorsRoutes } from "#src/features/customer-api/vendors/vendors.routes.ts";

import { buildTag } from "./buildTags.ts";

type ReviewInvalidationTarget = {
  kind: string;
  product_id?: number | null;
  vendor_id?: number | null;
};

export const buildReviewInvalidationTags = (reviews: ReviewInvalidationTarget[]) => [
  ...new Set([
    buildTag(customerReviewsRoutes.list),
    ...reviews.flatMap((review) => {
      if (review.kind === "PRODUCT" && review.product_id != null) {
        return [
          buildTag(customerReviewsRoutes.getByProduct, review.product_id),
          // Product list/detail responses include review aggregates.
          buildTag(customerProductsRoutes.getAll),
          buildTag(customerProductsRoutes.getById, review.product_id),
        ];
      }

      if (review.kind === "VENDOR" && review.vendor_id != null) {
        return [
          buildTag(customerVendorsRoutes.getReviews, review.vendor_id),
          // Vendor list/detail responses include review aggregates.
          buildTag(customerVendorsRoutes.getAll),
          buildTag(customerVendorsRoutes.getById, review.vendor_id),
        ];
      }

      return [];
    }),
  ]),
];
