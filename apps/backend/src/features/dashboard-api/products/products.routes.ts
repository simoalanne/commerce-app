import { ProductFormSchema } from "@acme/shared/schemas/products";
import { eq } from "drizzle-orm";
import z from "zod";

import type { Db } from "#src/db/client.ts";
import { orNotFound } from "#src/db/errors.ts";
import { productImageTable, productTable, productTagTable } from "#src/db/schema.ts";
import { categoriesRoutes as customerCategoriesRoutes } from "#src/features/customer-api/categories/categories.routes.ts";
import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { reviewsRoutes as customerReviewsRoutes } from "#src/features/customer-api/reviews/reviews.routes.ts";
import { storefrontRoutes } from "#src/features/customer-api/storefront/storefront.routes.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
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
    category_id: number | null;
    images: Array<{ image_id: number }>;
    tags: Array<{ tag_id: number }>;
  },
>(
  product: T,
) => ({
  ...product,
  images: product.images.map((image) => image.image_id),
  tags: product.tags.map((tag) => tag.tag_id),
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
  images: { columns: { image_id: true }, orderBy: { image_id: "asc" } },
  tags: { columns: { tag_id: true }, orderBy: { tag_id: "asc" } },
} as const;

const findProductForAudit = async (db: Db, id: number) =>
  orNotFound(
    await db.query.product.findFirst({
      where: { id },
      with: {
        ...productLinksWith,
        category: { columns: { id: true, name: true } },
        vendor: { columns: { id: true, name: true } },
      },
    }),
  );

const replaceProductLinks = async (
  db: Db,
  productId: number,
  { images, tags }: { images: number[]; tags: number[] },
) => {
  await db.delete(productImageTable).where(eq(productImageTable.product_id, productId));
  await db.delete(productTagTable).where(eq(productTagTable.product_id, productId));
  if (images.length > 0) {
    await db
      .insert(productImageTable)
      .values(images.map((imageId) => ({ product_id: productId, image_id: imageId })));
  }
  if (tags.length > 0) {
    await db
      .insert(productTagTable)
      .values(tags.map((tagId) => ({ product_id: productId, tag_id: tagId })));
  }
};

export const productsRoutes = {
  getAll: productRoute.get("/products").handler(async ({ context }) => {
    const products = await context.db.query.product.findMany({ with: productLinksWith });

    return toResponse(products.map(mapProduct), context.locale);
  }),

  getById: productRoute
    .get("/products/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const product = orNotFound(
        await context.db.query.product.findFirst({
          where: { id: params.id },
          with: productLinksWith,
        }),
      );

      return toResponse(mapProduct(product), context.locale);
    }),

  create: productTxRoute
    .post("/products")
    .body(ProductFormSchema)
    .handler(async ({ body, context }) => {
      const { category_id, vendor_id, images, tags, ...data } = body;

      const [{ id }] = await context.db
        .insert(productTable)
        .values({
          ...data,
          name: toLocalizedString(data.name, context.locale),
          slug: toLocalizedSlug(data.name, context.locale),
          headline: toLocalizedString(data.headline, context.locale),
          full_description: toLocalizedString(data.full_description, context.locale),
          category_id,
          vendor_id,
        })
        .returning({ id: productTable.id });
      await replaceProductLinks(context.db, id, { images, tags });
      const product = await findProductForAudit(context.db, id);

      await logAdminAction(context.db, {
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

      return toResponse({ id: product.id }, context.locale);
    }),

  update: productTxRoute
    .put("/products/:id")
    .params(idParams)
    .body(ProductFormSchema)
    .handler(async ({ params, body, context }) => {
      const { id } = params;
      const { category_id, images, tags, ...data } = body;
      const existingProduct = await findProductForAudit(context.db, id);

      await context.db
        .update(productTable)
        .set({
          name: mergeLocalizedString(existingProduct.name, data.name, context.locale),
          slug: mergeLocalizedSlug(existingProduct.slug, data.name, context.locale),
          weight_grams: data.weight_grams,
          headline: mergeLocalizedString(existingProduct.headline, data.headline, context.locale),
          full_description: mergeLocalizedString(
            existingProduct.full_description,
            data.full_description,
            context.locale,
          ),
          cost_price_cents: data.cost_price_cents,
          sales_price_cents: data.sales_price_cents,
          current_stock: data.current_stock,
          storefront_visibility: data.storefront_visibility,
          is_featured: data.is_featured,
          category_id: category_id ?? null,
          purchase_limit_per_order: data.purchase_limit_per_order,
        })
        .where(eq(productTable.id, id));
      await replaceProductLinks(context.db, id, { images, tags });
      const updated = await findProductForAudit(context.db, id);

      await logAdminAction(context.db, {
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

      await logAdminAction(context.db, {
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

    return toResponse(
      result.map(({ id, name }) => ({ id, name })),
      context.locale,
    );
  }),
};
