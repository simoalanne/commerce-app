import { WebhookSubscriptionFormSchema } from "@acme/shared/schemas/webhooks";
import z from "zod";

import { dashboardRoute } from "#src/routing/base.ts";
import { EntityInUse } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import tryDeleteEntity from "#src/utils/tryDeleteEntity.ts";

const webhookRoute = dashboardRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

export const webhooksRoutes = {
  getAll: webhookRoute.get("/webhooks").handler(async ({ context }) =>
    toResponse(
      await context.db.webhookSubscription.findMany({
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
        await context.db.webhookSubscription.findUniqueOrThrow({
          where: { id: params.id },
        }),
        context.locale,
      ),
    ),

  create: webhookRoute
    .post("/webhooks")
    .body(WebhookSubscriptionFormSchema)
    .handler(async ({ body, context }) => {
      const subscription = await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const subscription = await tx.webhookSubscription.create({
          data: body,
        });

        await logAdminAction({
          actor: context.authContext,
          action: "CREATE",
          entity: "webhookSubscription",
          entityId: subscription.id,
          after: subscription,
        });

        return subscription;
      });

      return toResponse({ id: subscription.id }, context.locale);
    }),

  update: webhookRoute
    .put("/webhooks/:id")
    .params(idParams)
    .body(WebhookSubscriptionFormSchema)
    .handler(async ({ params, body, context }) => {
      const existingSubscription = await context.db.webhookSubscription.findUniqueOrThrow({
        where: { id: params.id },
      });

      await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const updated = await tx.webhookSubscription.update({
          where: { id: params.id },
          data: body,
        });

        await logAdminAction({
          actor: context.authContext,
          action: "UPDATE",
          entity: "webhookSubscription",
          entityId: params.id,
          before: existingSubscription,
          after: updated,
        });
      });
    }),

  delete: webhookRoute
    .delete("/webhooks/:id")
    .params(idParams)
    .error(EntityInUse)
    .handler(async ({ params, context }) => {
      await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const deleted = await tryDeleteEntity(() =>
          tx.webhookSubscription.delete({
            where: { id: params.id },
          }),
        );

        await logAdminAction({
          actor: context.authContext,
          action: "DELETE",
          entity: "webhookSubscription",
          entityId: params.id,
          before: deleted,
        });
      });
    }),

  getOptionsForForm: webhookRoute.get("/webhooks/options-for-form").handler(async ({ context }) => {
    const subscriptions = await context.db.webhookSubscription.findMany({
      select: {
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
