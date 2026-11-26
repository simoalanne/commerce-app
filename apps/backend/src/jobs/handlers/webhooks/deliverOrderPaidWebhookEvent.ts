import { buildOrderPaidPayload } from "#src/jobs/handlers/orders/buildOrderPaidPayload.ts";

import { deliverInternalWebhookEvent } from "./deliverInternalWebhookEvent.ts";

type DeliverOrderPaidWebhookEventPayload = {
  orderId: number;
  url: string;
};

export async function deliverOrderPaidWebhookEvent({
  orderId,
  url,
}: DeliverOrderPaidWebhookEventPayload) {
  await deliverInternalWebhookEvent({
    event: "order.paid",
    url,
    data: await buildOrderPaidPayload(orderId),
  });
}
