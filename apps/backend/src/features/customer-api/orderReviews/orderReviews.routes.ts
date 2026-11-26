import { RouteError } from "@rest-rpc/server";
import z from "zod";

import { verifyOrderCapabilityJwt } from "#src/features/customer-api/orders/orderCapabilities.ts";
import { ordersRoutes as customerOrdersRoutes } from "#src/features/customer-api/orders/orders.routes.ts";
import { customerRoute } from "#src/routing/base.ts";
import { ImageUploadInvalidContentType, ImageUploadTooLarge } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { buildTag } from "#src/utils/buildTags.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";
import { buildReviewInvalidationTags } from "#src/utils/reviewInvalidationTags.ts";

const acceptedImageContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxUploadBytes = 10 * 1024 * 1024;

const savedReviewSchema = z
  .object({
    rating: z.int().min(1).max(5),
    comment: z.string().trim().max(1000).nullable(),
    showReviewerName: z.boolean(),
    objectKey: z.string().trim().min(1).nullable(),
  })
  .refine((value) => {
    const hasImage = !!value.objectKey;
    const hasComment = typeof value.comment === "string" && value.comment.trim().length > 0;

    // Image must have comment for context.
    return !(hasImage && !hasComment);
  });

const tokenQuery = z.object({
  token: z.string().trim().min(1),
});

// TODO: consider if reviews endpoints could also accept authContext and orderId instead of just token.
// This would reduce the need for authenticated users to generate a short-lived token just to submit reviews for their own orders.
export const orderReviewsRoutes = {
  getImagePresignedUrl: customerRoute
    .post("/order-reviews/image-upload")
    .query(tokenQuery)
    .body(
      z.object({
        contentType: z.string().trim().min(1),
        contentLength: z.number().int().positive(),
      }),
    )
    .error(ImageUploadInvalidContentType)
    .error(ImageUploadTooLarge)
    .handler(async ({ query, body, context }) => {
      const capability = await verifyOrderCapabilityJwt(context.config, {
        token: query.token,
        scope: "order:review",
      });

      // Prevent giving everyone access to upload images to our
      // object storage by ensuring the person actually has a valid order
      // before providing the presigned URL
      await context.db.order.findFirstOrThrow({
        where: {
          id: capability.orderId,
          status: "DELIVERED",
        },
        select: {
          id: true,
        },
      });

      if (!acceptedImageContentTypes.has(body.contentType)) {
        throw new ImageUploadInvalidContentType();
      }

      if (body.contentLength > maxUploadBytes) {
        throw new ImageUploadTooLarge();
      }

      return toResponse(
        await context.storage.getPresignedUrl({
          contentType: body.contentType,
          contentLength: body.contentLength,
        }),
        context.locale,
      );
    }),

  getByOrder: customerRoute
    .get("/order-reviews")
    .query(tokenQuery)
    .handler(async ({ query, context }) => {
      const capability = await verifyOrderCapabilityJwt(context.config, {
        token: query.token,
        scope: "order:review",
      });

      const order = await context.db.order.findFirstOrThrow({
        where: {
          id: capability.orderId,
          status: "DELIVERED",
        },
        select: {
          id: true,
          order_items: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: FIRST_LINKED_IMAGE_SELECT,
                  vendor: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          reviews: {
            select: {
              id: true,
              kind: true,
              product_id: true,
              vendor_id: true,
              show_reviewer_name: true,
              rating: true,
              comment: true,
              images: {
                select: {
                  storage_key: true,
                },
              },
            },
            orderBy: [{ kind: "asc" }, { id: "asc" }],
          },
        },
      });

      const products = [
        ...new Map(
          order.order_items.flatMap((item) =>
            item.product ? [[item.product.id, item.product] as const] : [],
          ),
        ).values(),
      ];

      const vendorsById = new Map(products.map((product) => [product.vendor.id, product.vendor]));

      const storeReviewRow = order.reviews.find((review) => review.kind === "STORE_EXPERIENCE");

      const storeReview = {
        kind: "STORE_EXPERIENCE" as const,
        review: !storeReviewRow
          ? null
          : {
              rating: storeReviewRow.rating,
              comment: storeReviewRow.comment,
              showReviewerName: storeReviewRow.show_reviewer_name,
              imageUrl: storeReviewRow.images?.[0]?.storage_key
                ? context.storage.getPublicUrl(storeReviewRow.images[0].storage_key)
                : null,
              objectKey: storeReviewRow.images?.[0]?.storage_key ?? null,
            },
      };

      const productReviews = products.map((product) => {
        const reviewRow = order.reviews.find(
          (review) => review.kind === "PRODUCT" && review.product_id === product.id,
        );

        return {
          kind: "PRODUCT" as const,
          productId: product.id,
          productName: product.name,
          vendorName: product.vendor.name,
          productImageUrl: getFirstLinkedImageUrl(context.storage, product.images),
          review: !reviewRow
            ? null
            : {
                rating: reviewRow.rating,
                comment: reviewRow.comment,
                showReviewerName: reviewRow.show_reviewer_name,
                imageUrl: reviewRow.images?.[0]?.storage_key
                  ? context.storage.getPublicUrl(reviewRow.images[0].storage_key)
                  : null,
                objectKey: reviewRow.images?.[0]?.storage_key ?? null,
              },
        };
      });

      const vendorReviews = [...vendorsById.values()].map((vendor) => {
        const reviewRow = order.reviews.find(
          (review) => review.kind === "VENDOR" && review.vendor_id === vendor.id,
        );

        return {
          kind: "VENDOR" as const,
          vendorId: vendor.id,
          vendorName: vendor.name,
          review: !reviewRow
            ? null
            : {
                rating: reviewRow.rating,
                comment: reviewRow.comment,
                showReviewerName: reviewRow.show_reviewer_name,
                imageUrl: reviewRow.images?.[0]?.storage_key
                  ? context.storage.getPublicUrl(reviewRow.images?.[0]?.storage_key)
                  : null,
                objectKey: reviewRow.images?.[0]?.storage_key ?? null,
              },
        };
      });

      return toResponse(
        {
          reviewables: [...productReviews, ...vendorReviews, storeReview],
        },
        context.locale,
      );
    }),

  saveByOrder: customerRoute
    .post("/order-reviews")
    .query(tokenQuery)
    .body(
      z.object({
        reviews: z
          .array(
            z.discriminatedUnion("kind", [
              z.object({
                kind: z.literal("PRODUCT"),
                productId: z.number().int().positive(),
                review: savedReviewSchema,
              }),
              z.object({
                kind: z.literal("VENDOR"),
                vendorId: z.number().int().positive(),
                review: savedReviewSchema,
              }),
              z.object({
                kind: z.literal("STORE_EXPERIENCE"),
                review: savedReviewSchema,
              }),
            ]),
          )
          .refine((reviewables) => {
            const productReviewIds = new Set<number>();
            const vendorReviewIds = new Set<number>();
            let storeReviewFound = false;

            for (const reviewable of reviewables) {
              if (reviewable.kind === "PRODUCT") {
                if (productReviewIds.has(reviewable.productId)) return false;
                productReviewIds.add(reviewable.productId);
                continue;
              }

              if (reviewable.kind === "VENDOR") {
                if (vendorReviewIds.has(reviewable.vendorId)) return false;
                vendorReviewIds.add(reviewable.vendorId);
                continue;
              }

              if (storeReviewFound) return false;
              storeReviewFound = true;
            }
            return true;
          }, "Invalid reviewables: duplicate product reviews, duplicate vendor reviews, or multiple store experience reviews"),
      }),
    )
    .handler(async ({ query, body, context }) => {
      const capability = await verifyOrderCapabilityJwt(context.config, {
        token: query.token,
        scope: "order:review",
      });
      const orderId = capability.orderId;

      const order = await context.db.order.findFirstOrThrow({
        where: {
          id: orderId,
          status: "DELIVERED",
        },
        select: {
          id: true,
          order_details: true,
          order_items: {
            select: {
              product: {
                select: {
                  id: true,
                  vendor: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
          reviews: {
            select: {
              id: true,
              kind: true,
              product_id: true,
              vendor_id: true,
            },
          },
        },
      });

      const products = [
        ...new Map(
          order.order_items.flatMap((item) =>
            item.product ? [[item.product.id, item.product] as const] : [],
          ),
        ).values(),
      ];

      const vendorIds = new Set(products.map((product) => product.vendor.id));

      const reviews = body.reviews;

      if (
        reviews.some(
          (review) =>
            review.kind === "PRODUCT" &&
            !products.some((product) => product.id === review.productId),
        )
      ) {
        throw new RouteError("BAD_REQUEST", {
          status: 400,
          message: "One or more reviews reference invalid productIds",
        });
      }

      if (reviews.some((review) => review.kind === "VENDOR" && !vendorIds.has(review.vendorId))) {
        throw new RouteError("BAD_REQUEST", {
          status: 400,
          message: "One or more reviews reference invalid vendorIds",
        });
      }

      const alreadyReviewed = reviews.some((review) => {
        if (review.kind === "PRODUCT") {
          return order.reviews.some(
            (existingReview) =>
              existingReview.kind === "PRODUCT" && existingReview.product_id === review.productId,
          );
        }

        if (review.kind === "VENDOR") {
          return order.reviews.some(
            (existingReview) =>
              existingReview.kind === "VENDOR" && existingReview.vendor_id === review.vendorId,
          );
        }

        return order.reviews.some((existingReview) => existingReview.kind === "STORE_EXPERIENCE");
      });

      if (alreadyReviewed) {
        throw new RouteError("BAD_REQUEST", {
          status: 400,
          message: "One or more reviewables have already been reviewed",
        });
      }

      const reviewerName = order.order_details.customer.name;
      const reviewInvalidationTargets = reviews.map((review) => {
        if (review.kind === "PRODUCT")
          return {
            kind: review.kind,
            product_id: review.productId,
            vendor_id: null,
          };

        if (review.kind === "VENDOR") {
          return {
            kind: review.kind,
            product_id: null,
            vendor_id: review.vendorId,
          };
        }

        return {
          kind: review.kind,
          product_id: null,
          vendor_id: null,
        };
      });

      await context.runAppTransaction(async ({ tx, enqueueJob }) => {
        for (const review of reviews) {
          await tx.review.create({
            data: {
              order: { connect: { id: orderId } },
              kind: review.kind,
              reviewer_name: reviewerName,
              product:
                review.kind === "PRODUCT" ? { connect: { id: review.productId } } : undefined,
              vendor: review.kind === "VENDOR" ? { connect: { id: review.vendorId } } : undefined,
              rating: review.review.rating,
              comment: review.review.comment,
              show_reviewer_name: review.review.showReviewerName,
              images: review.review.objectKey
                ? { create: [{ storage_key: review.review.objectKey }] }
                : undefined,
            },
          });
        }

        await enqueueJob({
          type: "invalidateStorefrontCache",
          payload: {
            tags: [
              ...buildReviewInvalidationTags(reviewInvalidationTargets),
              buildTag(customerOrdersRoutes.list),
              buildTag(customerOrdersRoutes.getById, orderId),
            ],
          },
        });
      });
    }),
};
