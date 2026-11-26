import { RouteError } from "@rest-rpc/server";
import z from "zod";

import { activeStorefrontVendorWhere } from "#src/domain/storefrontVisibility.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";

const getReviewSummary = (reviews: Array<{ rating: number }>) => {
  if (reviews.length === 0) {
    return {
      avgRating: null,
      totalRatings: null,
    };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    avgRating: Number((total / reviews.length).toFixed(1)),
    totalRatings: reviews.length,
  };
};

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
          reviews: {
            where: {
              kind: "VENDOR",
              status: "APPROVED",
            },
            columns: {
              rating: true,
            },
          },
        },
      });

      if (!vendor) {
        throw new RouteError("NOT_FOUND", { status: 404 });
      }

      return toResponse(
        {
          id: vendor.id,
          slug: vendor.slug,
          name: vendor.name,
          isFeatured: vendor.is_featured,
          imageUrl: getFirstLinkedImageUrl(context.storage, vendor.images),
          tags: vendor.tags,
          ...getReviewSummary(vendor.reviews),
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
        reviews: {
          where: {
            kind: "VENDOR",
            status: "APPROVED",
          },
          columns: {
            rating: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    return toResponse(
      vendors.map((vendor) => ({
        id: vendor.id,
        slug: vendor.slug,
        name: vendor.name,
        isFeatured: vendor.is_featured,
        imageUrl: getFirstLinkedImageUrl(context.storage, vendor.images),
        tags: vendor.tags,
        ...getReviewSummary(vendor.reviews),
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
          vendor_id: id,
        },
        orderBy: {
          updated_at: "desc",
        },
        limit,
      });

      return toResponse(
        reviews.map((review) => {
          const displayName = review.show_reviewer_name ? review.reviewer_name.trim() : "Anonymous";

          return {
            id: review.id,
            vendorId: review.vendor_id ?? id,
            rating: review.rating,
            comment: review.comment ?? null,
            createdAt: review.created_at,
            updatedAt: review.updated_at,
            reviewer: {
              isAnonymous: !review.show_reviewer_name,
              displayName,
            },
          };
        }),
        context.locale,
      );
    }),
};
