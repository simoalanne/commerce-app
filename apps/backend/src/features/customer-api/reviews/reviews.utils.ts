import { and, avg, count, eq, inArray } from "drizzle-orm";

import type { Db } from "#src/db/client.ts";
import { reviewTable } from "#src/db/schema.ts";

export type ProductReviewSummary = {
  avgRating: number;
  reviewCount: number;
};

const EMPTY_PRODUCT_REVIEW_SUMMARY: ProductReviewSummary = {
  avgRating: 0,
  reviewCount: 0,
};

export const getProductReviewSummaryMap = async (db: Db, productIds: number[]) => {
  const summaryMap = new Map<number, ProductReviewSummary>();

  if (productIds.length === 0) {
    return summaryMap;
  }

  const groupedReviews = await db
    .select({
      productId: reviewTable.productId,
      avgRating: avg(reviewTable.rating),
      reviewCount: count(),
    })
    .from(reviewTable)
    .where(
      and(
        eq(reviewTable.kind, "PRODUCT"),
        eq(reviewTable.status, "APPROVED"),
        inArray(reviewTable.productId, productIds),
      ),
    )
    .groupBy(reviewTable.productId);

  for (const groupedReview of groupedReviews) {
    if (groupedReview.productId == null) {
      continue;
    }

    summaryMap.set(groupedReview.productId, {
      avgRating:
        groupedReview.avgRating == null ? 0 : Number(Number(groupedReview.avgRating).toFixed(1)),
      reviewCount: groupedReview.reviewCount,
    });
  }

  return summaryMap;
};

export const getProductReviewSummaryByProductId = async (db: Db, productId: number) => {
  const summaryMap = await getProductReviewSummaryMap(db, [productId]);

  return summaryMap.get(productId) ?? EMPTY_PRODUCT_REVIEW_SUMMARY;
};

export const getReviewerDisplayName = (name: string, showReviewerName: boolean) => {
  if (!showReviewerName) {
    return null;
  }

  return name.trim();
};
