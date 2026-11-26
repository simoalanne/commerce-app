import { buildOrderRefundedPayload } from "#src/jobs/handlers/orders/buildOrderRefundedPayload.ts";

import { deliverInternalWebhookEvent } from "./deliverInternalWebhookEvent.ts";

type DeliverOrderRefundedWebhookEventPayload = {
  refundId: number;
  url: string;
};

export async function deliverOrderRefundedWebhookEvent({
  refundId,
  url,
}: DeliverOrderRefundedWebhookEventPayload) {
  await deliverInternalWebhookEvent({
    event: "order.refunded",
    url,
    data: await buildOrderRefundedPayload(refundId),
  });
}
