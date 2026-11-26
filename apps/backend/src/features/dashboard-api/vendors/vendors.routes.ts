import { slugify } from "@acme/shared";
import { VendorFormSchema } from "@acme/shared/schemas/vendors";
import z from "zod";

import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { reviewsRoutes as customerReviewsRoutes } from "#src/features/customer-api/reviews/reviews.routes.ts";
import { storefrontRoutes } from "#src/features/customer-api/storefront/storefront.routes.ts";
import { vendorsRoutes as customerVendorsRoutes } from "#src/features/customer-api/vendors/vendors.routes.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import { buildTag } from "#src/utils/buildTags.ts";
import { buildCreateImageLinks, buildReplaceImageLinks } from "#src/utils/imageLinks.ts";
import { mergeLocalizedString, toLocalizedString } from "#src/utils/localizedObject.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const vendorRoute = dashboardRoute.meta({ access: "ADMIN" });
const vendorTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const mapVendor = <T extends { images: Array<{ image_id: number }> }>(vendor: T) => ({
  ...vendor,
  images: vendor.images.map((image) => image.image_id),
});

const buildVendorInvalidationTags = (vendorId: number, productIds: number[] = []) => [
  buildTag(customerVendorsRoutes.getAll),
  buildTag(customerVendorsRoutes.getById, vendorId),
  buildTag(customerVendorsRoutes.getReviews, vendorId),
  // products.getAll entries reference vendor's fields.
  buildTag(customerProductsRoutes.getAll),
  // Storefront context returns id -> slug mappings for products, categories and vendors.
  buildTag(storefrontRoutes.getContext),
  ...productIds.flatMap((productId) => [
    buildTag(customerProductsRoutes.getById, productId),
    buildTag(customerReviewsRoutes.getByProduct, productId),
  ]),
];

const vendorMutationAuditInclude = {
  images: {
    select: {
      image_id: true,
    },
    orderBy: {
      image_id: "asc",
    },
  },
} as const;

export const vendorsRoutes = {
  getAll: vendorRoute.get("/vendors").handler(async ({ context }) => {
    const vendors = await context.db.vendor.findMany({
      include: {
        images: {
          select: {
            image_id: true,
          },
        },
      },
    });

    return toResponse(vendors.map(mapVendor), context.locale);
  }),

  getById: vendorRoute
    .get("/vendors/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const vendor = await context.db.vendor.findUniqueOrThrow({
        where: { id: params.id },
        include: {
          images: {
            select: {
              image_id: true,
            },
          },
        },
      });

      return toResponse(mapVendor(vendor), context.locale);
    }),

  create: vendorTxRoute
    .post("/vendors")
    .body(VendorFormSchema)
    .handler(async ({ body, context }) => {
      const { images, ...data } = body;

      const vendor = await context.db.vendor.create({
        data: {
          ...data,
          slug: slugify(data.name),
          slogan: toLocalizedString(data.slogan, context.locale),
          story: toLocalizedString(data.story, context.locale),
          tags: toLocalizedString(data.tags, context.locale),
          images: buildCreateImageLinks(images),
        },
        include: vendorMutationAuditInclude,
      });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "CREATE",
        entity: "vendor",
        entityId: vendor.id,
        after: vendor,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildVendorInvalidationTags(vendor.id) },
      });

      return toResponse({ id: vendor.id }, context.locale);
    }),

  update: vendorTxRoute
    .put("/vendors/:id")
    .params(idParams)
    .body(VendorFormSchema)
    .handler(async ({ params, body, context }) => {
      const { id } = params;
      const { images, ...data } = body;
      const existingVendor = await context.db.vendor.findUniqueOrThrow({
        where: { id },
        include: {
          ...vendorMutationAuditInclude,
          products: {
            select: {
              id: true,
            },
          },
        },
      });
      const affectedProductIds = existingVendor.products.map((product) => product.id);

      const updated = await context.db.vendor.update({
        where: { id },
        data: {
          slug: slugify(data.name),
          name: data.name,
          storefront_visibility: data.storefront_visibility,
          is_featured: data.is_featured,
          slogan: mergeLocalizedString(existingVendor.slogan, data.slogan, context.locale),
          story: mergeLocalizedString(existingVendor.story, data.story, context.locale),
          tags: mergeLocalizedString(existingVendor.tags, data.tags, context.locale),
          images: buildReplaceImageLinks(images),
        },
        include: vendorMutationAuditInclude,
      });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "UPDATE",
        entity: "vendor",
        entityId: id,
        before: existingVendor,
        after: updated,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: {
          tags: buildVendorInvalidationTags(id, affectedProductIds),
        },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: {
          productIds: affectedProductIds,
        },
      });
    }),

  delete: vendorTxRoute
    .delete("/vendors/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      const { id } = params;
      const vendor = await context.db.vendor.findUniqueOrThrow({
        where: { id },
        select: {
          products: {
            select: {
              id: true,
            },
          },
        },
      });

      const deleted = await tryDeleteEntity(() =>
        context.db.vendor.delete({
          where: { id },
          include: vendorMutationAuditInclude,
        }),
      );

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "DELETE",
        entity: "vendor",
        entityId: id,
        before: deleted,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: {
          tags: buildVendorInvalidationTags(
            id,
            vendor.products.map((product) => product.id),
          ),
        },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: {
          productIds: vendor.products.map((product) => product.id),
        },
      });
    }),

  getOptionsForForm: vendorRoute.get("/vendors/options-for-form").handler(async ({ context }) => {
    const result = await context.db.vendor.findMany({
      select: { id: true, name: true },
    });

    return toResponse(
      result.map(({ id, name }) => ({ id, name })),
      context.locale,
    );
  }),
};
