import { slugify } from "@acme/shared";
import { VendorFormSchema } from "@acme/shared/schemas/vendors";
import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import type { Db } from "#src/db/client.ts";
import { productTable, vendorImageTable, vendorTable } from "#src/db/schema.ts";
import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { reviewsRoutes as customerReviewsRoutes } from "#src/features/customer-api/reviews/reviews.routes.ts";
import { storefrontRoutes } from "#src/features/customer-api/storefront/storefront.routes.ts";
import { vendorsRoutes as customerVendorsRoutes } from "#src/features/customer-api/vendors/vendors.routes.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import { buildTag } from "#src/utils/buildTags.ts";
import { mergeLocalizedString, toLocalizedString } from "#src/utils/localizedObject.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const vendorRoute = dashboardRoute.meta({ access: "ADMIN" });
const vendorTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const mapVendor = <T extends { images: Array<{ imageId: number }> }>(vendor: T) => ({
  ...vendor,
  images: vendor.images.map((image) => image.imageId),
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

const findVendorForAudit = async (db: Db, id: number) => {
  const vendor = await db.query.vendor.findFirst({
    where: { id },
    with: { images: { columns: { imageId: true }, orderBy: { imageId: "asc" } } },
  });
  if (!vendor) throw new RouteError("NOT_FOUND", { status: 404 });
  return vendor;
};

const findVendorProductIds = async (db: Db, vendorId: number) =>
  (
    await db
      .select({ id: productTable.id })
      .from(productTable)
      .where(eq(productTable.vendorId, vendorId))
  ).map((product) => product.id);

const replaceVendorImages = async (db: Db, vendorId: number, imageIds: number[]) => {
  await db.delete(vendorImageTable).where(eq(vendorImageTable.vendorId, vendorId));
  if (imageIds.length > 0) {
    await db.insert(vendorImageTable).values(imageIds.map((imageId) => ({ vendorId, imageId })));
  }
};

export const vendorsRoutes = {
  getAll: vendorRoute.get("/vendors").handler(async ({ context }) => {
    const vendors = await context.db.query.vendor.findMany({
      with: {
        images: {
          columns: {
            imageId: true,
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
      const vendor = await context.db.query.vendor.findFirst({
        where: { id: params.id },
        with: {
          images: {
            columns: {
              imageId: true,
            },
          },
        },
      });
      if (!vendor) throw new RouteError("NOT_FOUND", { status: 404 });

      return toResponse(mapVendor(vendor), context.locale);
    }),

  create: vendorTxRoute
    .post("/vendors")
    .body(VendorFormSchema)
    .handler(async ({ body, context }) => {
      const { images, ...data } = body;

      const [{ id }] = await context.db
        .insert(vendorTable)
        .values({
          ...data,
          slug: slugify(data.name),
          slogan: toLocalizedString(data.slogan, context.locale),
          story: toLocalizedString(data.story, context.locale),
          tags: toLocalizedString(data.tags, context.locale),
        })
        .returning({ id: vendorTable.id });
      await replaceVendorImages(context.db, id, images);
      const vendor = await findVendorForAudit(context.db, id);

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
      const existingVendor = await findVendorForAudit(context.db, id);
      const affectedProductIds = await findVendorProductIds(context.db, id);

      await context.db
        .update(vendorTable)
        .set({
          slug: slugify(data.name),
          name: data.name,
          storefrontVisibility: data.storefrontVisibility,
          isFeatured: data.isFeatured,
          slogan: mergeLocalizedString(existingVendor.slogan, data.slogan, context.locale),
          story: mergeLocalizedString(existingVendor.story, data.story, context.locale),
          tags: mergeLocalizedString(existingVendor.tags, data.tags, context.locale),
        })
        .where(eq(vendorTable.id, id));
      await replaceVendorImages(context.db, id, images);
      const updated = await findVendorForAudit(context.db, id);

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
      const deleted = await findVendorForAudit(context.db, id);
      const productIds = await findVendorProductIds(context.db, id);

      await tryDeleteEntity(() => context.db.delete(vendorTable).where(eq(vendorTable.id, id)));

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
          tags: buildVendorInvalidationTags(id, productIds),
        },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: {
          productIds,
        },
      });
    }),

  getOptionsForForm: vendorRoute.get("/vendors/options-for-form").handler(async ({ context }) => {
    const result = await context.db.query.vendor.findMany({
      columns: { id: true, name: true },
    });

    return toResponse(
      result.map(({ id, name }) => ({ id, name })),
      context.locale,
    );
  }),
};
