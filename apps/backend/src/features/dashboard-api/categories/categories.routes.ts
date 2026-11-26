import { CategoryFormSchema } from "@acme/shared/schemas/categories";
import z from "zod";

import { categoriesRoutes as customerCategoriesRoutes } from "#src/features/customer-api/categories/categories.routes.ts";
import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
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

const categoryRoute = dashboardRoute.meta({ access: "ADMIN" });
const categoryTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  markup_percent: true,
  image_id: true,
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

const categoryMutationAuditInclude = {
  image: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

// TODO: move this field to the database somewhere where it makes sense.
// because I don't know where it makes sense in there (global, per category, etc.)
// It can remain hardcoded for now, but we should make it configurable in the future.
const DEFAULT_PRODUCT_MARKUP_PERCENT = 25;

export const categoriesRoutes = {
  getProductMarkupDefaults: categoryRoute
    .get("/categories/product-markup-defaults")
    .handler(async ({ context }) => {
      const categories = await context.db.category.findMany({
        select: { id: true, markup_percent: true },
      });

      return toResponse(
        {
          defaultMarkupPercent: DEFAULT_PRODUCT_MARKUP_PERCENT,
          categories: categories.map((category) => ({
            id: category.id,
            markupPercent: category.markup_percent,
          })),
        },
        context.locale,
      );
    }),

  getAll: categoryRoute
    .get("/categories")
    .handler(async ({ context }) =>
      toResponse(await context.db.category.findMany({ select: categorySelect }), context.locale),
    ),

  getById: categoryRoute
    .get("/categories/:id")
    .params(idParams)
    .handler(async ({ params, context }) =>
      toResponse(
        await context.db.category.findFirstOrThrow({
          where: { id: params.id },
          select: categorySelect,
        }),
        context.locale,
      ),
    ),

  create: categoryTxRoute
    .post("/categories")
    .body(CategoryFormSchema)
    .handler(async ({ body, context }) => {
      const category = await context.db.category.create({
        data: {
          name: toLocalizedString(body.name, context.locale),
          slug: toLocalizedSlug(body.name, context.locale),
          markup_percent: body.markup_percent,
          image: { connect: { id: body.image_id } },
        },
        include: categoryMutationAuditInclude,
      });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "CREATE",
        entity: "category",
        entityId: category.id,
        after: category,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: buildCategoryInvalidationTags() },
      });

      return toResponse({ id: category.id }, context.locale);
    }),

  update: categoryTxRoute
    .put("/categories/:id")
    .params(idParams)
    .body(CategoryFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingCategory = await context.db.category.findUniqueOrThrow({
        where: { id: params.id },
        include: {
          ...categoryMutationAuditInclude,
          products: { select: { id: true } },
        },
      });
      const affectedProductIds = existingCategory.products.map((product) => product.id);

      const updated = await context.db.category.update({
        where: { id: params.id },
        data: {
          name: mergeLocalizedString(existingCategory.name, body.name, context.locale),
          slug: mergeLocalizedSlug(existingCategory.slug, body.name, context.locale),
          markup_percent: body.markup_percent,
          image: { connect: { id: body.image_id } },
        },
        include: categoryMutationAuditInclude,
      });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "UPDATE",
        entity: "category",
        entityId: params.id,
        before: existingCategory,
        after: updated,
      });

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
      const category = await context.db.category.findUniqueOrThrow({
        where: { id: params.id },
        select: { products: { select: { id: true } } },
      });
      const productIds = category.products.map((product) => product.id);

      const deleted = await tryDeleteEntity(() =>
        context.db.category.delete({
          where: { id: params.id },
          include: categoryMutationAuditInclude,
        }),
      );

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "DELETE",
        entity: "category",
        entityId: params.id,
        before: deleted,
      });

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
      toResponse(
        await context.db.category.findMany({
          select: { id: true, name: true },
        }),
        context.locale,
      ),
    ),
};
