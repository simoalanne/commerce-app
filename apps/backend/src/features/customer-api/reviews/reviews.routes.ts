import { and, avg, count, eq } from "drizzle-orm";
import z from "zod";

import { reviewTable } from "#src/db/schema.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

import { getProductReviewSummaryByProductId, getReviewerDisplayName } from "./reviews.utils.ts";

export const reviewsRoutes = {
  list: customerRoute.get("/reviews").handler(async ({ context }) => {
    const LANDING_REVIEWS_LIMIT = 40;
    const LANDING_REVIEWS_FETCH_WINDOW = 200;

    const where = {
      status: "APPROVED" as const,
      kind: "PRODUCT" as const,
    };

    const [[summaryAggregate], reviews] = await Promise.all([
      context.db
        .select({ avgRating: avg(reviewTable.rating), reviewCount: count() })
        .from(reviewTable)
        .where(and(eq(reviewTable.status, where.status), eq(reviewTable.kind, where.kind))),
      context.db.query.review.findMany({
        where,
        orderBy: { created_at: "desc", id: "desc" },
        limit: LANDING_REVIEWS_FETCH_WINDOW,
        with: {
          images: {
            columns: {
              storage_key: true,
            },
          },
          product: {
            columns: {
              name: true,
              slug: true,
              storefront_visibility: true,
            },
            with: {
              images: {
                limit: 1,
                columns: {},
                with: { image: { columns: { storage_key: true } } },
              },
            },
          },
        },
      }),
    ]);

    const seenCustomerIds = new Set<number>();
    const publicReviews = reviews
      .filter((review) => {
        if (review.customer_id == null) {
          return true;
        }
        if (seenCustomerIds.has(review.customer_id)) {
          return false;
        }
        seenCustomerIds.add(review.customer_id);
        return true;
      })
      .slice(0, LANDING_REVIEWS_LIMIT)
      .map((review) => {
        if (!review.product) {
          throw new Error(`Expected product relation for product review ${review.id}`);
        }

        return {
          kind: "PRODUCT" as const,
          id: review.id,
          rating: review.rating,
          comment: review.comment ?? null,
          imageUrl: review.images?.[0]?.storage_key
            ? context.storage.getPublicUrl(review.images[0].storage_key)
            : null,
          customerName: getReviewerDisplayName(review.reviewer_name, review.show_reviewer_name),
          productName: review.product.name,
          productSlug: review.product.slug,
          isProductActive: review.product.storefront_visibility === "ACTIVE",
          productImageUrl: review.product.images[0]?.image.storage_key
            ? context.storage.getPublicUrl(review.product.images[0].image.storage_key)
            : null,
          createdAt: review.created_at,
        };
      });

    return toResponse(
      {
        summary: {
          avgRating:
            summaryAggregate.avgRating != null
              ? Number(Number(summaryAggregate.avgRating).toFixed(1))
              : 0,
          reviewCount: summaryAggregate.reviewCount,
        },
        reviews: publicReviews,
      },
      context.locale,
    );
  }),

  getByProduct: customerRoute
    .get("/reviews/products/:productId")
    .params(
      z.object({
        productId: z.coerce.number<number>().int().positive(),
      }),
    )
    .handler(async ({ params, context }) => {
      const [summary, reviews] = await Promise.all([
        getProductReviewSummaryByProductId(context.db, params.productId),
        context.db.query.review.findMany({
          where: {
            kind: "PRODUCT",
            status: "APPROVED",
            product_id: params.productId,
          },
          orderBy: { created_at: "desc", id: "desc" },
        }),
      ]);

      return toResponse(
        {
          summary,
          items: reviews.map((review) => ({
            id: review.id,
            productId: review.product_id ?? params.productId,
            rating: review.rating,
            comment: review.comment ?? null,
            createdAt: review.created_at,
            updatedAt: review.updated_at,
            reviewer: {
              isAnonymous: !review.show_reviewer_name,
              displayName: getReviewerDisplayName(review.reviewer_name, review.show_reviewer_name),
            },
          })),
        },
        context.locale,
      );
    }),
};
