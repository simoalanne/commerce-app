import { WebhookSubscriptionFormSchema } from "@acme/shared/schemas/webhooks";
import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { webhookSubscriptionTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
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

      return { id: subscription.id };
    }),

  update: webhookTxRoute
    .put("/webhooks/:id")
    .params(idParams)
    .body(WebhookSubscriptionFormSchema)
    .handler(async ({ params, body, context }) => {
      const [updated] = await context.db
        .update(webhookSubscriptionTable)
        .set(body)
        .where(eq(webhookSubscriptionTable.id, params.id))
        .returning({ id: webhookSubscriptionTable.id });
      if (!updated) throw new RouteError("NOT_FOUND", { status: 404 });
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
