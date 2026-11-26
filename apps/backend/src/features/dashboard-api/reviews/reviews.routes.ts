import z from "zod";

import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { buildReviewInvalidationTags } from "#src/utils/reviewInvalidationTags.ts";

const reviewRoute = dashboardRoute.meta({ access: "ADMIN" });

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
      const reviews = await context.db.review.findMany({
        where: query.status ? { status: query.status } : {},
        orderBy: [{ updated_at: "desc" }, { id: "desc" }],
        select: {
          id: true,
          kind: true,
          status: true,
          rating: true,
          comment: true,
          order_id: true,
          created_at: true,
          updated_at: true,
          images: {
            select: {
              id: true,
              storage_key: true,
            },
          },
          vendor: {
            select: {
              name: true,
            },
          },
          product: {
            select: {
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

  updateStatus: reviewRoute
    .put("/reviews/:id/status")
    .params(z.object({ id: z.coerce.number<number>().int().positive() }))
    .body(z.object({ status: reviewStatusSchema }))
    .handler(async ({ params, body, context }) => {
      const existingReview = await context.db.review.findUniqueOrThrow({
        where: { id: params.id },
        select: {
          status: true,
          kind: true,
          product_id: true,
          vendor_id: true,
        },
      });

      await context.runAppTransaction(async ({ tx, enqueueJob, logAdminAction }) => {
        const review = await tx.review.update({
          where: { id: params.id },
          data: { status: body.status },
          select: {
            kind: true,
            product_id: true,
            vendor_id: true,
          },
        });

        await logAdminAction({
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

        await enqueueJob({
          type: "invalidateStorefrontCache",
          payload: { tags: buildReviewInvalidationTags([review]) },
        });
      });
    }),
};
