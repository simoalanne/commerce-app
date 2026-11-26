import { and, count, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "#src/db/client.ts";
import { reviewTable } from "#src/db/schema.ts";

export type ReviewSummary = {
  avgRating: number;
  reviewCount: number;
};

/** Average rating and count of approved reviews, by product or vendor id. */
export const getReviewSummaryMap = async (
  db: Db,
  kind: "PRODUCT" | "VENDOR",
  ids: number[],
): Promise<Map<number, ReviewSummary>> => {
  if (ids.length === 0) return new Map();

  const subjectId = kind === "PRODUCT" ? reviewTable.productId : reviewTable.vendorId;
  const rows = await db
    .select({
      subjectId,
      avgRating: sql<number>`round(avg(${reviewTable.rating}), 1)`.mapWith(Number),
      reviewCount: count(),
    })
    .from(reviewTable)
    .where(
      and(eq(reviewTable.kind, kind), eq(reviewTable.status, "APPROVED"), inArray(subjectId, ids)),
    )
    .groupBy(subjectId);

  return new Map(
    rows.flatMap(({ subjectId: id, ...summary }) => (id == null ? [] : [[id, summary]])),
  );
};

export const getReviewerDisplayName = (name: string, showReviewerName: boolean) => {
  if (!showReviewerName) {
    return null;
  }

  return name.trim();
};
