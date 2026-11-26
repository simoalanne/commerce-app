import { ProductFormSchema } from "@acme/shared/schemas/products";
import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import type { Db } from "#src/db/client.ts";
import { productImageTable, productTable, productTagTable } from "#src/db/schema.ts";
import { categoriesRoutes as customerCategoriesRoutes } from "#src/features/customer-api/categories/categories.routes.ts";
import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { reviewsRoutes as customerReviewsRoutes } from "#src/features/customer-api/reviews/reviews.routes.ts";
import { storefrontRoutes } from "#src/features/customer-api/storefront/storefront.routes.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import { buildTag } from "#src/utils/buildTags.ts";
import {
  mergeLocalizedSlug,
  mergeLocalizedString,
  toLocalizedSlug,
  toLocalizedString,
} from "#src/utils/localizedObject.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const productRoute = dashboardRoute.meta({ access: "ADMIN" });
const productTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const mapProduct = <
  T extends {
    categoryId: number | null;
    images: Array<{ imageId: number }>;
    tags: Array<{ tagId: number }>;
  },
>(
  product: T,
) => ({
  ...product,
  images: product.images.map((image) => image.imageId),
  tags: product.tags.map((tag) => tag.tagId),
});

const buildProductInvalidationTags = (productId: number) => [
  buildTag(customerProductsRoutes.getAll),
  buildTag(customerProductsRoutes.getById, productId),
  // reviews.list embeds product name, slug and image for product reviews.
  buildTag(customerReviewsRoutes.list),
  // Product delete cascades product reviews, and keeping this fresh is cheap.
  buildTag(customerReviewsRoutes.getByProduct, productId),
  // categories.getAll includes productCount. Keep this if category product
  // counts remain sourced from the category endpoint. Currently unused in
  // the online store and can be derived from other endpoints so this is candidate
  // for removal if we want to reduce the number of invalidation rules.
  buildTag(customerCategoriesRoutes.getAll),
  // Storefront context returns id -> slug mappings for products, categories and vendors.
  buildTag(storefrontRoutes.getContext),
];

const productLinksWith = {
  images: { columns: { imageId: true }, orderBy: { imageId: "asc" } },
  tags: { columns: { tagId: true }, orderBy: { tagId: "asc" } },
} as const;

const findProductForAudit = async (db: Db, id: number) => {
  const product = await db.query.product.findFirst({
    where: { id },
    with: {
      ...productLinksWith,
      category: { columns: { id: true, name: true } },
      vendor: { columns: { id: true, name: true } },
    },
  });
  if (!product) throw new RouteError("NOT_FOUND", { status: 404 });
  return product;
};

const replaceProductLinks = async (
  db: Db,
  productId: number,
  { images, tags }: { images: number[]; tags: number[] },
) => {
  await db.delete(productImageTable).where(eq(productImageTable.productId, productId));
  await db.delete(productTagTable).where(eq(productTagTable.productId, productId));
  if (images.length > 0) {
    await db.insert(productImageTable).values(images.map((imageId) => ({ productId, imageId })));
  }
  if (tags.length > 0) {
    await db.insert(productTagTable).values(tags.map((tagId) => ({ productId, tagId })));
  }
};

export const productsRoutes = {
  getAll: productRoute.get("/products").handler(async ({ context }) => {
    const products = await context.db.query.product.findMany({ with: productLinksWith });

    return resolveLocalizedFields(products.map(mapProduct), context.locale);
  }),

  getById: productRoute
    .get("/products/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const product = await context.db.query.product.findFirst({
        where: { id: params.id },
        with: productLinksWith,
      });
      if (!product) throw new RouteError("NOT_FOUND", { status: 404 });

      return resolveLocalizedFields(mapProduct(product), context.locale);
    }),

  create: productTxRoute
    .post("/products")
    .body(ProductFormSchema)
    .handler(async ({ body, context }) => {
      const { categoryId, vendorId, images, tags, ...data } = body;

      const [{ id }] = await context.db
        .insert(productTable)
        .values({
          ...data,
          name: toLocalizedString(data.name, context.locale),
          slug: toLocalizedSlug(data.name, context.locale),
          headline: toLocalizedString(data.headline, context.locale),
          fullDescription: toLocalizedString(data.fullDescription, context.locale),
          categoryId,
          vendorId,
        })
        .returning({ id: productTable.id });
      await replaceProductLinks(context.db, id, { images, tags });
      const product = await findProductForAudit(context.db, id);

      await logAdminAction(context, {
        actor: context.authContext,
        action: "CREATE",
        entity: "product",
        entityId: product.id,
        after: product,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildProductInvalidationTags(product.id) },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: { productIds: [product.id] },
      });

      return { id: product.id };
    }),

  update: productTxRoute
    .put("/products/:id")
    .params(idParams)
    .body(ProductFormSchema)
    .handler(async ({ params, body, context }) => {
      const { id } = params;
      const { categoryId, images, tags, ...data } = body;
      const existingProduct = await findProductForAudit(context.db, id);

      await context.db
        .update(productTable)
        .set({
          name: mergeLocalizedString(existingProduct.name, data.name, context.locale),
          slug: mergeLocalizedSlug(existingProduct.slug, data.name, context.locale),
          weightGrams: data.weightGrams,
          headline: mergeLocalizedString(existingProduct.headline, data.headline, context.locale),
          fullDescription: mergeLocalizedString(
            existingProduct.fullDescription,
            data.fullDescription,
            context.locale,
          ),
          costPriceCents: data.costPriceCents,
          salesPriceCents: data.salesPriceCents,
          currentStock: data.currentStock,
          storefrontVisibility: data.storefrontVisibility,
          isFeatured: data.isFeatured,
          categoryId: categoryId ?? null,
          purchaseLimitPerOrder: data.purchaseLimitPerOrder,
        })
        .where(eq(productTable.id, id));
      await replaceProductLinks(context.db, id, { images, tags });
      const updated = await findProductForAudit(context.db, id);

      await logAdminAction(context, {
        actor: context.authContext,
        action: "UPDATE",
        entity: "product",
        entityId: id,
        before: existingProduct,
        after: updated,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildProductInvalidationTags(id) },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: { productIds: [id] },
      });
    }),

  delete: productTxRoute
    .delete("/products/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      const { id } = params;

      const deleted = await findProductForAudit(context.db, id);
      await tryDeleteEntity(() => context.db.delete(productTable).where(eq(productTable.id, id)));

      await logAdminAction(context, {
        actor: context.authContext,
        action: "DELETE",
        entity: "product",
        entityId: id,
        before: deleted,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildProductInvalidationTags(id) },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: { productIds: [id] },
      });
    }),

  getOptionsForForm: productRoute.get("/products/options-for-form").handler(async ({ context }) => {
    const result = await context.db.query.product.findMany({
      columns: { id: true, name: true, sku: true },
    });

    return resolveLocalizedFields(
      result.map(({ id, name }) => ({ id, name })),
      context.locale,
    );
  }),
};
