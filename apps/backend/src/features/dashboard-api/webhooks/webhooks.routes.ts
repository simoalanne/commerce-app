import { WebhookSubscriptionFormSchema } from "@acme/shared/schemas/webhooks";
import { eq } from "drizzle-orm";
import z from "zod";

import { orNotFound } from "#src/db/errors.ts";
import { webhookSubscriptionTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const webhookRoute = dashboardRoute.meta({ access: "ADMIN" });
const webhookTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

export const webhooksRoutes = {
  getAll: webhookRoute.get("/webhooks").handler(async ({ context }) =>
    toResponse(
      await context.db.query.webhookSubscription.findMany({
        orderBy: {
          id: "asc",
        },
      }),
      context.locale,
    ),
  ),

  getById: webhookRoute
    .get("/webhooks/:id")
    .params(idParams)
    .handler(async ({ params, context }) =>
      toResponse(
        orNotFound(
          await context.db.query.webhookSubscription.findFirst({
            where: { id: params.id },
          }),
        ),
        context.locale,
      ),
    ),

  create: webhookTxRoute
    .post("/webhooks")
    .body(WebhookSubscriptionFormSchema)
    .handler(async ({ body, context }) => {
      const [subscription] = await context.db
        .insert(webhookSubscriptionTable)
        .values(body)
        .returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "CREATE",
        entity: "webhookSubscription",
        entityId: subscription.id,
        after: subscription,
      });

      return toResponse({ id: subscription.id }, context.locale);
    }),

  update: webhookTxRoute
    .put("/webhooks/:id")
    .params(idParams)
    .body(WebhookSubscriptionFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingSubscription = orNotFound(
        await context.db.query.webhookSubscription.findFirst({
          where: { id: params.id },
        }),
      );

      const [updated] = await context.db
        .update(webhookSubscriptionTable)
        .set(body)
        .where(eq(webhookSubscriptionTable.id, params.id))
        .returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "UPDATE",
        entity: "webhookSubscription",
        entityId: params.id,
        before: existingSubscription,
        after: updated,
      });
    }),

  delete: webhookTxRoute
    .delete("/webhooks/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      const deleted = await tryDeleteEntity(async () =>
        orNotFound(
          (
            await context.db
              .delete(webhookSubscriptionTable)
              .where(eq(webhookSubscriptionTable.id, params.id))
              .returning()
          )[0],
        ),
      );

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "DELETE",
        entity: "webhookSubscription",
        entityId: params.id,
        before: deleted,
      });
    }),

  getOptionsForForm: webhookRoute.get("/webhooks/options-for-form").handler(async ({ context }) => {
    const subscriptions = await context.db.query.webhookSubscription.findMany({
      columns: {
        id: true,
        event: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return toResponse(
      subscriptions.map(({ id, event }) => ({
        id,
        name: event,
      })),
      context.locale,
    );
  }),
};
