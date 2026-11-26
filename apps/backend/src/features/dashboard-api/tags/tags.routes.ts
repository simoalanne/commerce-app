import z from "zod";

import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import { buildTag } from "#src/utils/buildTags.ts";
import { mergeLocalizedString, toLocalizedString } from "#src/utils/localizedObject.ts";

const tagRoute = dashboardRoute.meta({ access: "ADMIN" });
const tagTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #22c55e");

const TagFormSchema = z.object({
  name: z.string().min(1),
  color: HexColorSchema,
  // Derived, read-only: how many products use the tag. Populated on reads
  // (getAll), ignored on create/update.
  productCount: z.number().int().optional(),
});

// A tag's name/color is embedded into product listings, so a change to either
// must refresh the product surfaces that render it.
const tagInvalidationTags = () => [buildTag(customerProductsRoutes.getAll)];

export const tagsRoutes = {
  getAll: tagRoute.get("/tags").handler(async ({ context }) => {
    const tags = await context.db.tag.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { products: true } },
      },
      orderBy: { id: "asc" },
    });

    return toResponse(
      tags.map(({ _count, ...tag }) => ({
        ...tag,
        productCount: _count.products,
      })),
      context.locale,
    );
  }),

  getById: tagRoute
    .get("/tags/:id")
    .params(idParams)
    .handler(async ({ params, context }) =>
      toResponse(
        await context.db.tag.findUniqueOrThrow({
          where: { id: params.id },
          select: { id: true, name: true, color: true },
        }),
        context.locale,
      ),
    ),

  create: tagTxRoute
    .post("/tags")
    .body(TagFormSchema)
    .handler(async ({ body, context }) => {
      const tag = await context.db.tag.create({
        data: {
          name: toLocalizedString(body.name, context.locale),
          color: body.color,
        },
      });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "CREATE",
        entity: "tag",
        entityId: tag.id,
        after: tag,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: tagInvalidationTags() },
      });

      return toResponse({ id: tag.id }, context.locale);
    }),

  update: tagTxRoute
    .put("/tags/:id")
    .params(idParams)
    .body(TagFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingTag = await context.db.tag.findUniqueOrThrow({
        where: { id: params.id },
      });

      const updated = await context.db.tag.update({
        where: { id: params.id },
        data: {
          name: mergeLocalizedString(existingTag.name, body.name, context.locale),
          color: body.color,
        },
      });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "UPDATE",
        entity: "tag",
        entityId: params.id,
        before: existingTag,
        after: updated,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: tagInvalidationTags() },
      });
    }),

  delete: tagTxRoute
    .delete("/tags/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      // Tags are a shared library: deleting one removes it from every product
      // that uses it (the dashboard confirms first). Unlink before deleting so
      // the ProductTag restrict constraint is satisfied.
      await context.db.productTag.deleteMany({ where: { tag_id: params.id } });
      const deleted = await context.db.tag.delete({ where: { id: params.id } });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "DELETE",
        entity: "tag",
        entityId: params.id,
        before: deleted,
      });

      await context.enqueueJob({
        type: "invalidateStorefrontCache",
        payload: { tags: tagInvalidationTags() },
      });
    }),

  getOptionsForForm: tagRoute.get("/tags/options-for-form").handler(async ({ context }) => {
    const result = await context.db.tag.findMany({
      select: { id: true, name: true },
    });
    return toResponse(
      result.map(({ id, name }) => ({ id, name })),
      context.locale,
    );
  }),
};
