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
        orderBy: { createdAt: "desc", id: "desc" },
        limit: LANDING_REVIEWS_FETCH_WINDOW,
        with: {
          images: {
            columns: {
              storageKey: true,
            },
          },
          product: {
            columns: {
              name: true,
              slug: true,
              storefrontVisibility: true,
            },
            with: {
              images: {
                limit: 1,
                columns: {},
                with: { image: { columns: { storageKey: true } } },
              },
            },
          },
        },
      }),
    ]);

    const seenCustomerIds = new Set<number>();
    const publicReviews = reviews
      .filter((review) => {
        if (review.customerId == null) {
          return true;
        }
        if (seenCustomerIds.has(review.customerId)) {
          return false;
        }
        seenCustomerIds.add(review.customerId);
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
          imageUrl: review.images?.[0]?.storageKey
            ? context.storage.getPublicUrl(review.images[0].storageKey)
            : null,
          customerName: getReviewerDisplayName(review.reviewerName, review.showReviewerName),
          productName: review.product.name,
          productSlug: review.product.slug,
          isProductActive: review.product.storefrontVisibility === "ACTIVE",
          productImageUrl: review.product.images[0]?.image.storageKey
            ? context.storage.getPublicUrl(review.product.images[0].image.storageKey)
            : null,
          createdAt: review.createdAt,
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
            productId: params.productId,
          },
          orderBy: { createdAt: "desc", id: "desc" },
        }),
      ]);

      return toResponse(
        {
          summary,
          items: reviews.map((review) => ({
            id: review.id,
            productId: review.productId ?? params.productId,
            rating: review.rating,
            comment: review.comment ?? null,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            reviewer: {
              isAnonymous: !review.showReviewerName,
              displayName: getReviewerDisplayName(review.reviewerName, review.showReviewerName),
            },
          })),
        },
        context.locale,
      );
    }),
};
