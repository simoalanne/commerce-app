import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { productTagTable, tagTable } from "#src/db/schema.ts";
import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";
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
    const tags = await context.db.query.tag.findMany({
      columns: {
        id: true,
        name: true,
        color: true,
      },
      extras: {
        productCount: (tag) =>
          context.db.$count(productTagTable, eq(productTagTable.tagId, tag.id)),
      },
      orderBy: { id: "asc" },
    });

    return resolveLocalizedFields(tags, context.locale);
  }),

  getById: tagRoute
    .get("/tags/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const tag = await context.db.query.tag.findFirst({
        where: { id: params.id },
        columns: { id: true, name: true, color: true },
      });
      if (!tag) throw new RouteError("NOT_FOUND", { status: 404 });
      return resolveLocalizedFields(tag, context.locale);
    }),

  create: tagTxRoute
    .post("/tags")
    .body(TagFormSchema)
    .handler(async ({ body, context }) => {
      const [tag] = await context.db
        .insert(tagTable)
        .values({
          name: toLocalizedString(body.name, context.locale),
          color: body.color,
        })
        .returning();

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

      return { id: tag.id };
    }),

  update: tagTxRoute
    .put("/tags/:id")
    .params(idParams)
    .body(TagFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingTag = await context.db.query.tag.findFirst({
        where: { id: params.id },
      });
      if (!existingTag) throw new RouteError("NOT_FOUND", { status: 404 });

      const [updated] = await context.db
        .update(tagTable)
        .set({
          name: mergeLocalizedString(existingTag.name, body.name, context.locale),
          color: body.color,
        })
        .where(eq(tagTable.id, params.id))
        .returning();

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
      await context.db.delete(productTagTable).where(eq(productTagTable.tagId, params.id));
      const deleted = (
        await context.db.delete(tagTable).where(eq(tagTable.id, params.id)).returning()
      )[0];
      if (!deleted) throw new RouteError("NOT_FOUND", { status: 404 });

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
    const result = await context.db.query.tag.findMany({
      columns: { id: true, name: true },
    });
    return resolveLocalizedFields(
      result.map(({ id, name }) => ({ id, name })),
      context.locale,
    );
  }),
};
