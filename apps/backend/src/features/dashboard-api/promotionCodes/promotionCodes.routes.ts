import { PromotionCodeFormSchema } from "@acme/shared/schemas/promotionCodes";
import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { promotionCodeTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const promotionCodeRoute = dashboardRoute.meta({ access: "ADMIN" });
const promotionCodeTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

export const promotionCodesRoutes = {
  getAll: promotionCodeRoute.get("/promotion-codes").handler(
    async ({ context }) =>
      await context.db.query.promotionCode.findMany({
        orderBy: { createdAt: "desc", id: "desc" },
      }),
  ),

  getById: promotionCodeRoute
    .get("/promotion-codes/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const promotionCode = await context.db.query.promotionCode.findFirst({
        where: {
          id: params.id,
        },
      });
      if (!promotionCode) throw new RouteError("NOT_FOUND", { status: 404 });
      return promotionCode;
    }),

  create: promotionCodeTxRoute
    .post("/promotion-codes")
    .body(PromotionCodeFormSchema)
    .handler(async ({ body, context }) => {
      const [promotionCode] = await context.db.insert(promotionCodeTable).values(body).returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "CREATE",
        entity: "promotionCode",
        entityId: promotionCode.id,
        after: promotionCode,
      });

      return { id: promotionCode.id };
    }),

  update: promotionCodeTxRoute
    .put("/promotion-codes/:id")
    .params(idParams)
    .body(PromotionCodeFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingPromotionCode = await context.db.query.promotionCode.findFirst({
        where: { id: params.id },
      });
      if (!existingPromotionCode) throw new RouteError("NOT_FOUND", { status: 404 });

      const [updated] = await context.db
        .update(promotionCodeTable)
        .set(body)
        .where(eq(promotionCodeTable.id, params.id))
        .returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "UPDATE",
        entity: "promotionCode",
        entityId: params.id,
        before: existingPromotionCode,
        after: updated,
      });
    }),

  delete: promotionCodeTxRoute
    .delete("/promotion-codes/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      const [deleted] = await tryDeleteEntity(() =>
        context.db
          .delete(promotionCodeTable)
          .where(eq(promotionCodeTable.id, params.id))
          .returning(),
      );
      if (!deleted) throw new RouteError("NOT_FOUND", { status: 404 });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "DELETE",
        entity: "promotionCode",
        entityId: params.id,
        before: deleted,
      });
    }),

  getOptionsForForm: promotionCodeRoute
    .get("/promotion-codes/options-for-form")
    .handler(async ({ context }) => {
      const promotionCodes = await context.db.query.promotionCode.findMany({
        columns: {
          id: true,
          code: true,
        },
        orderBy: { code: "asc", id: "asc" },
      });

      return promotionCodes.map(({ id, code }) => ({
        id,
        name: code,
      }));
    }),
};
