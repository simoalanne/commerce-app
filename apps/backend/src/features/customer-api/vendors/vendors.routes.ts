import { RouteError } from "@rest-rpc/server";
import z from "zod";

import { activeStorefrontVendorWhere } from "#src/domain/storefrontVisibility.ts";
import {
  getReviewSummaryMap,
  type ReviewSummary,
} from "#src/features/customer-api/reviews/reviews.utils.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";

// Vendors without approved reviews have no rating rather than a zero.
const toRating = (summary: ReviewSummary | undefined) => ({
  avgRating: summary?.avgRating ?? null,
  totalRatings: summary?.reviewCount ?? null,
});

export const vendorsRoutes = {
  getById: customerRoute
    .get("/vendors/:id")
    .params(
      z.object({
        id: z.coerce.number<number>(),
      }),
    )
    .handler(async ({ params, context }) => {
      const vendor = await context.db.query.vendor.findFirst({
        where: activeStorefrontVendorWhere({ vendorId: params.id }),
        with: {
          images: FIRST_LINKED_IMAGE_SELECT,
        },
      });

      if (!vendor) {
        throw new RouteError("NOT_FOUND", { status: 404 });
      }
      const ratings = await getReviewSummaryMap(context.db, "VENDOR", [vendor.id]);

      return toResponse(
        {
          id: vendor.id,
          slug: vendor.slug,
          name: vendor.name,
          isFeatured: vendor.isFeatured,
          imageUrl: getFirstLinkedImageUrl(context.storage, vendor.images),
          tags: vendor.tags,
          ...toRating(ratings.get(vendor.id)),
          story: vendor.story,
          slogan: vendor.slogan,
        },
        context.locale,
      );
    }),

  getAll: customerRoute.get("/vendors").handler(async ({ context }) => {
    const vendors = await context.db.query.vendor.findMany({
      where: activeStorefrontVendorWhere(),
      with: {
        images: FIRST_LINKED_IMAGE_SELECT,
      },
      orderBy: {
        id: "asc",
      },
    });
    const ratings = await getReviewSummaryMap(
      context.db,
      "VENDOR",
      vendors.map((vendor) => vendor.id),
    );

    return toResponse(
      vendors.map((vendor) => ({
        id: vendor.id,
        slug: vendor.slug,
        name: vendor.name,
        isFeatured: vendor.isFeatured,
        imageUrl: getFirstLinkedImageUrl(context.storage, vendor.images),
        tags: vendor.tags,
        ...toRating(ratings.get(vendor.id)),
      })),
      context.locale,
    );
  }),

  getReviews: customerRoute
    .get("/vendors/:id/reviews")
    .params(
      z.object({
        id: z.coerce.number<number>().int().positive(),
      }),
    )
    .query(
      z.object({
        limit: z.coerce.number<number>().int().min(1).max(20).optional(),
      }),
    )
    .handler(async ({ params, query, context }) => {
      const { id } = params;
      const { limit = 10 } = query;

      const vendor = await context.db.query.vendor.findFirst({
        where: activeStorefrontVendorWhere({ vendorId: id }),
        columns: { id: true },
      });
      if (!vendor) throw new RouteError("NOT_FOUND", { status: 404 });

      const reviews = await context.db.query.review.findMany({
        where: {
          kind: "VENDOR",
          status: "APPROVED",
          vendorId: id,
        },
        orderBy: {
          updatedAt: "desc",
        },
        limit,
      });

      return toResponse(
        reviews.map((review) => {
          const displayName = review.showReviewerName ? review.reviewerName.trim() : "Anonymous";

          return {
            id: review.id,
            vendorId: review.vendorId ?? id,
            rating: review.rating,
            comment: review.comment ?? null,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            reviewer: {
              isAnonymous: !review.showReviewerName,
              displayName,
            },
          };
        }),
        context.locale,
      );
    }),
};
