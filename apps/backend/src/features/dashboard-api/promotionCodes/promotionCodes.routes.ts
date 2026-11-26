import { PromotionCodeFormSchema } from "@acme/shared/schemas/promotionCodes";
import { eq } from "drizzle-orm";
import z from "zod";

import { orNotFound } from "#src/db/errors.ts";
import { promotionCodeTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const promotionCodeRoute = dashboardRoute.meta({ access: "ADMIN" });
const promotionCodeTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const toPromotionCodeWriteData = <
  T extends {
    created_at?: Date;
    updated_at?: Date;
    times_used?: number;
  },
>(
  request: T,
) => {
  const {
    created_at: _createdAt,
    updated_at: _updatedAt,
    times_used: _timesUsed,
    ...data
  } = request;

  return data;
};

export const promotionCodesRoutes = {
  getAll: promotionCodeRoute.get("/promotion-codes").handler(async ({ context }) =>
    toResponse(
      await context.db.query.promotionCode.findMany({
        orderBy: { created_at: "desc", id: "desc" },
      }),
      context.locale,
    ),
  ),

  getById: promotionCodeRoute
    .get("/promotion-codes/:id")
    .params(idParams)
    .handler(async ({ params, context }) =>
      toResponse(
        orNotFound(
          await context.db.query.promotionCode.findFirst({
            where: {
              id: params.id,
            },
          }),
        ),
        context.locale,
      ),
    ),

  create: promotionCodeTxRoute
    .post("/promotion-codes")
    .body(PromotionCodeFormSchema)
    .handler(async ({ body, context }) => {
      const [promotionCode] = await context.db
        .insert(promotionCodeTable)
        .values(toPromotionCodeWriteData(body))
        .returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "CREATE",
        entity: "promotionCode",
        entityId: promotionCode.id,
        after: promotionCode,
      });

      return toResponse({ id: promotionCode.id }, context.locale);
    }),

  update: promotionCodeTxRoute
    .put("/promotion-codes/:id")
    .params(idParams)
    .body(PromotionCodeFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingPromotionCode = orNotFound(
        await context.db.query.promotionCode.findFirst({
          where: { id: params.id },
        }),
      );

      const [updated] = await context.db
        .update(promotionCodeTable)
        .set(toPromotionCodeWriteData(body))
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
      const deleted = await tryDeleteEntity(async () =>
        orNotFound(
          (
            await context.db
              .delete(promotionCodeTable)
              .where(eq(promotionCodeTable.id, params.id))
              .returning()
          )[0],
        ),
      );

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

      return toResponse(
        promotionCodes.map(({ id, code }) => ({
          id,
          name: code,
        })),
        context.locale,
      );
    }),
};
