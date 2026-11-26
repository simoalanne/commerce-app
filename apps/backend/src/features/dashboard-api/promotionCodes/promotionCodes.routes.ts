import { PromotionCodeFormSchema } from "@acme/shared/schemas/promotionCodes";
import z from "zod";

import { dashboardRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const promotionCodeRoute = dashboardRoute.meta({ access: "ADMIN" });

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
      await context.db.promotionCode.findMany({
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
      }),
      context.locale,
    ),
  ),

  getById: promotionCodeRoute
    .get("/promotion-codes/:id")
    .params(idParams)
    .handler(async ({ params, context }) =>
      toResponse(
        await context.db.promotionCode.findUniqueOrThrow({
          where: {
            id: params.id,
          },
        }),
        context.locale,
      ),
    ),

  create: promotionCodeRoute
    .post("/promotion-codes")
    .body(PromotionCodeFormSchema)
    .handler(async ({ body, context }) => {
      const promotionCode = await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const promotionCode = await tx.promotionCode.create({
          data: toPromotionCodeWriteData(body),
        });

        await logAdminAction({
          actor: context.authContext,
          action: "CREATE",
          entity: "promotionCode",
          entityId: promotionCode.id,
          after: promotionCode,
        });

        return promotionCode;
      });

      return toResponse({ id: promotionCode.id }, context.locale);
    }),

  update: promotionCodeRoute
    .put("/promotion-codes/:id")
    .params(idParams)
    .body(PromotionCodeFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingPromotionCode = await context.db.promotionCode.findUniqueOrThrow({
        where: { id: params.id },
      });

      await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const updated = await tx.promotionCode.update({
          where: { id: params.id },
          data: toPromotionCodeWriteData(body),
        });

        await logAdminAction({
          actor: context.authContext,
          action: "UPDATE",
          entity: "promotionCode",
          entityId: params.id,
          before: existingPromotionCode,
          after: updated,
        });
      });
    }),

  delete: promotionCodeRoute
    .delete("/promotion-codes/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const deleted = await tryDeleteEntity(() =>
          tx.promotionCode.delete({
            where: { id: params.id },
          }),
        );

        await logAdminAction({
          actor: context.authContext,
          action: "DELETE",
          entity: "promotionCode",
          entityId: params.id,
          before: deleted,
        });
      });
    }),

  getOptionsForForm: promotionCodeRoute
    .get("/promotion-codes/options-for-form")
    .handler(async ({ context }) => {
      const promotionCodes = await context.db.promotionCode.findMany({
        select: {
          id: true,
          code: true,
        },
        orderBy: [{ code: "asc" }, { id: "asc" }],
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
