import { WebhookSubscriptionFormSchema } from "@acme/shared/schemas/webhooks";
import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { webhookSubscriptionTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const webhookRoute = dashboardRoute.meta({ access: "ADMIN" });
const webhookTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

export const webhooksRoutes = {
  getAll: webhookRoute.get("/webhooks").handler(
    async ({ context }) =>
      await context.db.query.webhookSubscription.findMany({
        orderBy: {
          id: "asc",
        },
      }),
  ),

  getById: webhookRoute
    .get("/webhooks/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const subscription = await context.db.query.webhookSubscription.findFirst({
        where: { id: params.id },
      });
      if (!subscription) throw new RouteError("NOT_FOUND", { status: 404 });
      return subscription;
    }),

  create: webhookTxRoute
    .post("/webhooks")
    .body(WebhookSubscriptionFormSchema)
    .handler(async ({ body, context }) => {
      const [subscription] = await context.db
        .insert(webhookSubscriptionTable)
        .values(body)
        .returning();

      await logAdminAction(context, {
        actor: context.authContext,
        action: "CREATE",
        entity: "webhookSubscription",
        entityId: subscription.id,
        after: subscription,
      });

      return { id: subscription.id };
    }),

  update: webhookTxRoute
    .put("/webhooks/:id")
    .params(idParams)
    .body(WebhookSubscriptionFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingSubscription = await context.db.query.webhookSubscription.findFirst({
        where: { id: params.id },
      });
      if (!existingSubscription) throw new RouteError("NOT_FOUND", { status: 404 });

      const [updated] = await context.db
        .update(webhookSubscriptionTable)
        .set(body)
        .where(eq(webhookSubscriptionTable.id, params.id))
        .returning();

      await logAdminAction(context, {
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
      const [deleted] = await tryDeleteEntity(() =>
        context.db
          .delete(webhookSubscriptionTable)
          .where(eq(webhookSubscriptionTable.id, params.id))
          .returning(),
      );
      if (!deleted) throw new RouteError("NOT_FOUND", { status: 404 });

      await logAdminAction(context, {
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

    return subscriptions.map(({ id, event }) => ({
      id,
      name: event,
    }));
  }),
};
