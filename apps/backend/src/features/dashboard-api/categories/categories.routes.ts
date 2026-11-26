import { CategoryFormSchema } from "@acme/shared/schemas/categories";
import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { categoryTable } from "#src/db/schema.ts";
import { categoriesRoutes as customerCategoriesRoutes } from "#src/features/customer-api/categories/categories.routes.ts";
import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { storefrontRoutes } from "#src/features/customer-api/storefront/storefront.routes.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";
import { buildTag } from "#src/utils/buildTags.ts";
import {
  mergeLocalizedSlug,
  mergeLocalizedString,
  toLocalizedSlug,
  toLocalizedString,
} from "#src/utils/localizedObject.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const categoryRoute = dashboardRoute.meta({ access: "ADMIN" });
const categoryTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const categoryColumns = {
  id: true,
  name: true,
  slug: true,
  markupPercent: true,
  imageId: true,
} as const;

// NOTE: this intentionally avoids precise invalidation rules. Before we have
// thousands of products, invalidating product/category surfaces is easier to
// audit than maintaining field-specific cache rules.
const buildCategoryInvalidationTags = (productIds: number[] = []) => [
  buildTag(customerCategoriesRoutes.getAll),
  buildTag(customerProductsRoutes.getAll),
  // Storefront context returns id -> slug mappings for products, categories and vendors.
  buildTag(storefrontRoutes.getContext),
  ...productIds.map((productId) => buildTag(customerProductsRoutes.getById, productId)),
];

// TODO: move this field to the database somewhere where it makes sense.
// because I don't know where it makes sense in there (global, per category, etc.)
// It can remain hardcoded for now, but we should make it configurable in the future.
const DEFAULT_PRODUCT_MARKUP_PERCENT = 25;

export const categoriesRoutes = {
  getProductMarkupDefaults: categoryRoute
    .get("/categories/product-markup-defaults")
    .handler(async ({ context }) => {
      const categories = await context.db.query.category.findMany({
        columns: { id: true, markupPercent: true },
      });

      return {
        defaultMarkupPercent: DEFAULT_PRODUCT_MARKUP_PERCENT,
        categories: categories.map((category) => ({
          id: category.id,
          markupPercent: category.markupPercent,
        })),
      };
    }),

  getAll: categoryRoute
    .get("/categories")
    .handler(async ({ context }) =>
      resolveLocalizedFields(
        await context.db.query.category.findMany({ columns: categoryColumns }),
        context.locale,
      ),
    ),

  getById: categoryRoute
    .get("/categories/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const category = await context.db.query.category.findFirst({
        where: { id: params.id },
        columns: categoryColumns,
      });
      if (!category) throw new RouteError("NOT_FOUND", { status: 404 });
      return resolveLocalizedFields(category, context.locale);
    }),

  create: categoryTxRoute
    .post("/categories")
    .body(CategoryFormSchema)
    .handler(async ({ body, context }) => {
      const [{ id }] = await context.db
        .insert(categoryTable)
        .values({
          name: toLocalizedString(body.name, context.locale),
          slug: toLocalizedSlug(body.name, context.locale),
          markupPercent: body.markupPercent,
          imageId: body.imageId,
        })
        .returning({ id: categoryTable.id });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildCategoryInvalidationTags() },
      });

      return { id };
    }),

  update: categoryTxRoute
    .put("/categories/:id")
    .params(idParams)
    .body(CategoryFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingCategory = await context.db.query.category.findFirst({
        where: { id: params.id },
        columns: { name: true, slug: true },
      });
      if (!existingCategory) throw new RouteError("NOT_FOUND", { status: 404 });
      const affectedProducts = await context.db.query.product.findMany({
        where: { categoryId: params.id },
        columns: { id: true },
      });
      const affectedProductIds = affectedProducts.map((product) => product.id);

      await context.db
        .update(categoryTable)
        .set({
          name: mergeLocalizedString(existingCategory.name, body.name, context.locale),
          slug: mergeLocalizedSlug(existingCategory.slug, body.name, context.locale),
          markupPercent: body.markupPercent,
          imageId: body.imageId,
        })
        .where(eq(categoryTable.id, params.id));

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: {
          tags: buildCategoryInvalidationTags(affectedProductIds),
        },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: { productIds: affectedProductIds },
      });
    }),

  delete: categoryTxRoute
    .delete("/categories/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      const products = await context.db.query.product.findMany({
        where: { categoryId: params.id },
        columns: { id: true },
      });
      const productIds = products.map((product) => product.id);

      await tryDeleteEntity(() =>
        context.db.delete(categoryTable).where(eq(categoryTable.id, params.id)),
      );

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildCategoryInvalidationTags(productIds) },
      });
      await context.enqueueJob({
        type: "invalidateSearchIndex",
        payload: { productIds },
      });
    }),

  getOptionsForForm: categoryRoute
    .get("/categories/options-for-form")
    .handler(async ({ context }) =>
      resolveLocalizedFields(
        await context.db.query.category.findMany({
          columns: { id: true, name: true },
        }),
        context.locale,
      ),
    ),
};
