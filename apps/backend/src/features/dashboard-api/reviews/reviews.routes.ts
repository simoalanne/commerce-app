import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { reviewTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import { buildReviewInvalidationTags } from "#src/utils/reviewInvalidationTags.ts";

const reviewRoute = dashboardRoute.meta({ access: "ADMIN" });
const reviewTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const reviewStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

const storeExperienceLabel = "Acme Experience";

export const reviewsRoutes = {
  getAll: reviewRoute
    .get("/reviews")
    .query(
      z.object({
        status: reviewStatusSchema.optional(),
      }),
    )
    .handler(async ({ query, context }) => {
      const reviews = await context.db.query.review.findMany({
        where: query.status ? { status: query.status } : {},
        orderBy: { updatedAt: "desc", id: "desc" },
        columns: {
          id: true,
          kind: true,
          status: true,
          rating: true,
          comment: true,
          orderId: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          images: {
            columns: {
              id: true,
              storageKey: true,
            },
          },
          vendor: {
            columns: {
              name: true,
            },
          },
          product: {
            columns: {
              name: true,
            },
          },
        },
      });

      return toResponse(
        reviews.map((review) => {
          const baseRecord = {
            id: review.id,
            status: review.status,
            rating: review.rating,
            comment: review.comment,
            orderId: review.orderId,
            image: review.images[0]
              ? {
                  id: review.images[0].id,
                  url: context.storage.getPublicUrl(review.images[0].storageKey),
                }
              : null,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          };

          switch (review.kind) {
            case "VENDOR":
              if (!review.vendor) {
                throw new Error("Vendor review is missing vendor relation");
              }

              return {
                ...baseRecord,
                kind: review.kind,
                targetLabel: review.vendor.name,
              };
            case "PRODUCT":
              if (!review.product) {
                throw new Error("Product review is missing product relation");
              }

              return {
                ...baseRecord,
                kind: review.kind,
                targetLabel: review.product.name,
              };
            case "STORE_EXPERIENCE":
              return {
                ...baseRecord,
                kind: review.kind,
                targetLabel: storeExperienceLabel,
              };
            default:
              throw new Error(`Unsupported review kind: ${review.kind}`);
          }
        }),
        context.locale,
      );
    }),

  updateStatus: reviewTxRoute
    .put("/reviews/:id/status")
    .params(z.object({ id: z.coerce.number<number>().int().positive() }))
    .body(z.object({ status: reviewStatusSchema }))
    .handler(async ({ params, body, context }) => {
      const existingReview = await context.db.query.review.findFirst({
        where: { id: params.id },
        columns: {
          status: true,
          kind: true,
          productId: true,
          vendorId: true,
        },
      });
      if (!existingReview) throw new RouteError("NOT_FOUND", { status: 404 });

      const [review] = await context.db
        .update(reviewTable)
        .set({ status: body.status })
        .where(eq(reviewTable.id, params.id))
        .returning({
          kind: reviewTable.kind,
          productId: reviewTable.productId,
          vendorId: reviewTable.vendorId,
        });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "OTHER",
        entity: "review",
        entityId: params.id,
        details: {
          operation: "review.updateStatus",
          reviewId: params.id,
          fromStatus: existingReview.status,
          toStatus: body.status,
          kind: review.kind,
          productId: review.productId,
          vendorId: review.vendorId,
        },
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildReviewInvalidationTags([review]) },
      });
    }),
};
