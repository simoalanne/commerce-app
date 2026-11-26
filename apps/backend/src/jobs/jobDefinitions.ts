import z from "zod";

import { invalidateStorefrontCache } from "./handlers/cache-invalidation/invalidateStorefrontCache.ts";
import { sendNewOrderNotificationEmail } from "./handlers/emails/sendNewOrderNotificationEmail.ts";
import { sendOrderConfirmationEmail } from "./handlers/emails/sendOrderConfirmationEmail.ts";
import { sendOrderRefundedEmail } from "./handlers/emails/sendOrderRefundedEmail.ts";
import { sendOrderReviewInvitationEmail } from "./handlers/emails/sendOrderReviewInvitationEmail.ts";
import { expirePendingOrder } from "./handlers/orders/expirePendingOrder.ts";
import { processRefund } from "./handlers/orders/processRefund.ts";
import { shipOrder } from "./handlers/orders/shipOrder.ts";
import { invalidateSearchIndex } from "./handlers/search/invalidateSearchIndex.ts";
import { deliverInternalWebhookEvent } from "./handlers/webhooks/deliverInternalWebhookEvent.ts";
import { deliverOrderPaidWebhookEvent } from "./handlers/webhooks/deliverOrderPaidWebhookEvent.ts";
import { deliverOrderRefundedWebhookEvent } from "./handlers/webhooks/deliverOrderRefundedWebhookEvent.ts";

export const jobDefinitions = {
  sendNewOrderNotificationEmail: {
    schema: z.object({
      orderId: z.number().int().positive(),
    }),
    handler: sendNewOrderNotificationEmail,
  },
  sendOrderConfirmationEmail: {
    schema: z.object({
      orderId: z.number().int().positive(),
    }),
    handler: sendOrderConfirmationEmail,
  },
  sendOrderReviewInvitationEmail: {
    schema: z.object({
      orderId: z.number().int().positive(),
    }),
    handler: sendOrderReviewInvitationEmail,
  },
  deliverInternalWebhookEvent: {
    schema: z.object({
      event: z.string().min(1),
      url: z.url(),
      data: z.record(z.string(), z.unknown()),
    }),
    handler: deliverInternalWebhookEvent,
  },
  deliverOrderPaidWebhookEvent: {
    schema: z.object({
      orderId: z.number().int().positive(),
      url: z.url(),
    }),
    handler: deliverOrderPaidWebhookEvent,
  },
  invalidateStorefrontCache: {
    schema: z.object({
      tags: z.array(z.string().min(1)),
    }),
    handler: invalidateStorefrontCache,
  },
  invalidateSearchIndex: {
    schema: z.object({
      productIds: z.array(z.int()),
    }),
    handler: invalidateSearchIndex,
  },
  expirePendingOrder: {
    schema: z.object({
      orderId: z.number().int().positive(),
    }),
    handler: expirePendingOrder,
  },
  shipOrder: {
    schema: z.object({
      orderId: z.number().int().positive(),
    }),
    handler: shipOrder,
  },
  processRefund: {
    schema: z.object({
      refundId: z.number().int().positive(),
    }),
    handler: processRefund,
  },
  sendOrderRefundedEmail: {
    schema: z.object({
      refundId: z.number().int().positive(),
    }),
    handler: sendOrderRefundedEmail,
  },
  deliverOrderRefundedWebhookEvent: {
    schema: z.object({
      refundId: z.number().int().positive(),
      url: z.url(),
    }),
    handler: deliverOrderRefundedWebhookEvent,
  },
} as const;

export type JobType = keyof typeof jobDefinitions;

export type JobPayload<T extends JobType> = z.infer<(typeof jobDefinitions)[T]["schema"]>;
