import type { Prisma } from "@prisma/client";

export type ProductReviewSummary = {
  avgRating: number;
  reviewCount: number;
};

const EMPTY_PRODUCT_REVIEW_SUMMARY: ProductReviewSummary = {
  avgRating: 0,
  reviewCount: 0,
};

export const getProductReviewSummaryMap = async (
  db: Prisma.TransactionClient,
  productIds: number[],
) => {
  const summaryMap = new Map<number, ProductReviewSummary>();

  if (productIds.length === 0) {
    return summaryMap;
  }

  const groupedReviews = await db.review.groupBy({
    by: ["product_id"],
    where: {
      kind: "PRODUCT",
      status: "APPROVED",
      product_id: {
        in: productIds,
      },
    },
    _avg: {
      rating: true,
    },
    _count: {
      id: true,
    },
  });

  for (const groupedReview of groupedReviews) {
    if (groupedReview.product_id == null) {
      continue;
    }

    summaryMap.set(groupedReview.product_id, {
      avgRating:
        groupedReview._avg.rating == null ? 0 : Number(groupedReview._avg.rating.toFixed(1)),
      reviewCount: groupedReview._count.id,
    });
  }

  return summaryMap;
};

export const getProductReviewSummaryByProductId = async (
  db: Prisma.TransactionClient,
  productId: number,
) => {
  const summaryMap = await getProductReviewSummaryMap(db, [productId]);

  return summaryMap.get(productId) ?? EMPTY_PRODUCT_REVIEW_SUMMARY;
};

export const getReviewerDisplayName = (name: string, showReviewerName: boolean) => {
  if (!showReviewerName) {
    return null;
  }

  return name.trim();
};
