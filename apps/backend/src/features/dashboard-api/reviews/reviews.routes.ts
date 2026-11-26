import { eq } from "drizzle-orm";
import z from "zod";

import { orNotFound } from "#src/db/errors.ts";
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
        orderBy: { updated_at: "desc", id: "desc" },
        columns: {
          id: true,
          kind: true,
          status: true,
          rating: true,
          comment: true,
          order_id: true,
          created_at: true,
          updated_at: true,
        },
        with: {
          images: {
            columns: {
              id: true,
              storage_key: true,
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
            orderId: review.order_id,
            image: review.images[0]
              ? {
                  id: review.images[0].id,
                  url: context.storage.getPublicUrl(review.images[0].storage_key),
                }
              : null,
            createdAt: review.created_at,
            updatedAt: review.updated_at,
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
      const existingReview = orNotFound(
        await context.db.query.review.findFirst({
          where: { id: params.id },
          columns: {
            status: true,
            kind: true,
            product_id: true,
            vendor_id: true,
          },
        }),
      );

      const [review] = await context.db
        .update(reviewTable)
        .set({ status: body.status })
        .where(eq(reviewTable.id, params.id))
        .returning({
          kind: reviewTable.kind,
          product_id: reviewTable.product_id,
          vendor_id: reviewTable.vendor_id,
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
          productId: review.product_id,
          vendorId: review.vendor_id,
        },
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildReviewInvalidationTags([review]) },
      });
    }),
};
