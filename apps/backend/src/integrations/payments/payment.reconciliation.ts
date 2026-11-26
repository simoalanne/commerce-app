import type { OrderStatus, Prisma } from "@prisma/client";
import * as Sentry from "@sentry/node";

import {
  commitAsMuchStockAsPossible,
  commitReservedStock,
  releaseReservedStock,
} from "#src/features/customer-api/checkout/checkout.adjustStock.ts";
import {
  enqueueOrderRefundSucceededSideEffectJobs,
  enqueueProductStockInvalidationJobs,
} from "#src/jobs/handlers/jobAggregrates.ts";
import type { TransactionalEnqueueJob } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";
import { runAppTransaction } from "#src/utils/runAppTransaction.ts";

import type { PaymentProviderName } from "./payment.provider.ts";

type PendingOrderState = {
  previousStatus: OrderStatus;
  updated: boolean;
  orderDetails: PrismaJson.OrderDetails;
  appliedPromoCode: string | null;
};

const getOrderStockAdjustments = async ({
  orderId,
  transaction,
}: {
  orderId: number;
  transaction: Prisma.TransactionClient;
}) =>
  transaction.orderItem.findMany({
    where: { order_id: orderId },
    select: {
      id: true,
      sku: true,
      quantity: true,
      product_id: true,
    },
  });

export type PaymentReconciliationEvent = {
  provider: PaymentProviderName;
  orderId: number;
  paymentId: string | null;
  result: "paid" | "canceled";
};

export type RefundReconciliationEvent = {
  provider: PaymentProviderName;
  refundId: number | null;
  refundKey: string | null;
  paymentId: string | null;
  amountCents: number;
  result: "succeeded" | "failed";
};

const enqueueOrderPaidJobs = async ({
  orderId,
  transaction,
  enqueueJob,
}: {
  orderId: number;
  transaction: Prisma.TransactionClient;
  enqueueJob: TransactionalEnqueueJob;
}) => {
  await enqueueJob({
    type: "sendOrderConfirmationEmail",
    payload: { orderId },
  });

  await enqueueJob({
    type: "sendNewOrderNotificationEmail",
    payload: { orderId },
  });

  const subscribers = await transaction.webhookSubscription.findMany({
    where: { event: "order.paid" },
    select: { url: true },
  });

  for (const subscriber of subscribers) {
    await enqueueJob({
      type: "deliverOrderPaidWebhookEvent",
      payload: {
        orderId,
        url: subscriber.url,
      },
    });
  }
};

const updatePendingOrderStatus = async ({
  orderId,
  paymentId,
  status,
  transaction,
}: {
  orderId: number;
  paymentId: string | null;
  status: OrderStatus;
  transaction: Prisma.TransactionClient;
}) => {
  const [state] = await transaction.$queryRaw<PendingOrderState[]>`
		WITH current AS (
			SELECT status, order_details, applied_promo_code
			FROM "Order"
			WHERE id = ${orderId}
			FOR UPDATE
		),
		updated AS (
			UPDATE "Order"
			SET status = ${status}::"OrderStatus",
				payment_id = ${paymentId}
			WHERE id = ${orderId}
				AND status = 'PENDING'
			RETURNING id
		)
		SELECT
			current.status AS "previousStatus",
			EXISTS (SELECT 1 FROM updated) AS updated,
			current.order_details AS "orderDetails",
			current.applied_promo_code AS "appliedPromoCode"
		FROM current;
	`;

  return state;
};

const recoverPaidOrderAfterPendingCancellation = async ({
  orderId,
  paymentId,
  previousStatus,
  logTag,
  transaction,
  enqueueJob,
}: {
  orderId: number;
  paymentId: string | null;
  previousStatus: Extract<OrderStatus, "EXPIRED">;
  logTag: string;
  transaction: Prisma.TransactionClient;
  enqueueJob: TransactionalEnqueueJob;
}) => {
  const recoveredOrder = await transaction.order.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      payment_id: paymentId,
      paid_at: new Date(),
    },
    select: {
      order_details: true,
      applied_promo_code: true,
      order_items: {
        select: {
          id: true,
          sku: true,
          quantity: true,
          product_id: true,
        },
      },
    },
  });

  const shortfalls = await commitAsMuchStockAsPossible({
    items: recoveredOrder.order_items,
    transaction,
  });

  for (const orderItem of recoveredOrder.order_items) {
    const uncommittedQuantity = shortfalls.find(
      (shortfall) => shortfall.sku === orderItem.sku,
    )?.uncommittedQuantity;

    if (!uncommittedQuantity) {
      continue;
    }

    await transaction.orderItem.update({
      where: { id: orderItem.id },
      data: { uncommitted_quantity: uncommittedQuantity },
    });
  }

  await incrementPromoCodeUsage({
    promoCode: recoveredOrder.applied_promo_code,
    transaction,
  });
  await enqueueProductStockInvalidationJobs({
    productIds: recoveredOrder.order_items.flatMap((item) =>
      item.product_id == null ? [] : [item.product_id],
    ),
    enqueueJob,
  });
  await enqueueOrderPaidJobs({
    orderId,
    transaction,
    enqueueJob,
  });

  if (shortfalls.length > 0) {
    logger.warn(
      "Recovered order that was already canceled before payment confirmation with stock shortfall",
      {
        orderId,
        paymentId,
        shortfallItems: shortfalls,
        tag: logTag,
      },
    );
  } else {
    logger.warn("Recovered order that was already canceled before payment confirmation", {
      orderId,
      paymentId,
      tag: logTag,
    });
  }

  return {
    previousStatus,
    updated: true,
    orderDetails: recoveredOrder.order_details,
    appliedPromoCode: recoveredOrder.applied_promo_code,
  };
};

const incrementPromoCodeUsage = async ({
  promoCode,
  transaction,
}: {
  promoCode: string | null;
  transaction: Prisma.TransactionClient;
}) => {
  if (!promoCode) {
    return;
  }

  await transaction.promotionCode.updateMany({
    where: { code: promoCode },
    data: {
      times_used: {
        increment: 1,
      },
    },
  });
};

const expirePendingOrder = async ({ orderId, paymentId, provider }: PaymentReconciliationEvent) => {
  const targetStatus: OrderStatus = "EXPIRED";
  const logTag = `${provider.toLowerCase()}-payment-reconciliation`;

  return await runAppTransaction(async ({ tx, enqueueJob }) => {
    const state = await updatePendingOrderStatus({
      orderId,
      paymentId,
      status: targetStatus,
      transaction: tx,
    });

    if (!state) {
      logger.error("Order that is supposed to be expired was not found", {
        orderId,
        paymentId,
        provider,
        targetStatus,
        tag: logTag,
      });
      return null;
    }

    if (!state.updated) {
      logger.warn(
        "Received payment cancellation callback for order that is already reconciled from pending to final status",
        {
          orderId,
          paymentId,
          provider,
          previousStatus: state.previousStatus,
          targetStatus,
          tag: logTag,
        },
      );
      return null;
    }

    const orderItems = await getOrderStockAdjustments({
      orderId,
      transaction: tx,
    });

    await releaseReservedStock({
      items: orderItems,
      transaction: tx,
    });
    await enqueueProductStockInvalidationJobs({
      productIds: orderItems.flatMap((item) => (item.product_id == null ? [] : [item.product_id])),
      enqueueJob,
    });

    return state;
  });
};

export const reconcileOrder = async ({
  orderId,
  paymentId,
  provider,
  result,
}: PaymentReconciliationEvent) => {
  if (result === "canceled") {
    return expirePendingOrder({
      orderId,
      paymentId,
      provider,
      result,
    });
  }

  const targetStatus: OrderStatus = "PAID";
  const logTag = `${provider.toLowerCase()}-payment-reconciliation`;

  return await runAppTransaction(async ({ tx, enqueueJob }) => {
    const state = await updatePendingOrderStatus({
      orderId,
      paymentId,
      status: targetStatus,
      transaction: tx,
    });

    if (!state) {
      logger.error("Order that is supposed to be reconciled was not found", {
        orderId,
        paymentId,
        provider,
        targetStatus,
        tag: logTag,
      });
      return null;
    }

    if (!state.updated) {
      if (state.previousStatus === "EXPIRED") {
        return await recoverPaidOrderAfterPendingCancellation({
          orderId,
          paymentId,
          previousStatus: state.previousStatus,
          logTag,
          transaction: tx,
          enqueueJob,
        });
      }

      logger.warn(
        "Received payment callback for order that is already reconciled from pending to final status",
        {
          orderId,
          paymentId,
          provider,
          previousStatus: state.previousStatus,
          targetStatus,
          tag: logTag,
        },
      );
      return null;
    }

    await tx.order.update({
      where: { id: orderId },
      data: { paid_at: new Date() },
    });

    const orderItems = await getOrderStockAdjustments({
      orderId,
      transaction: tx,
    });

    await commitReservedStock({
      items: orderItems,
      transaction: tx,
    });
    await incrementPromoCodeUsage({
      promoCode: state.appliedPromoCode,
      transaction: tx,
    });
    await enqueueOrderPaidJobs({
      orderId,
      transaction: tx,
      enqueueJob,
    });

    return state;
  });
};

export const reconcileRefund = async ({
  refundId,
  refundKey,
  paymentId,
  provider,
  amountCents,
  result,
}: RefundReconciliationEvent) => {
  const logTag = `${provider.toLowerCase()}-refund-reconciliation`;

  return await runAppTransaction(async ({ tx, enqueueJob }) => {
    const refund = await tx.refund.findFirst({
      where: {
        OR: [
          ...(paymentId ? [{ provider_refund_id: paymentId }] : []),
          ...(refundId ? [{ id: refundId }] : []),
          ...(refundKey ? [{ idempotency_key: refundKey }] : []),
        ],
      },
      select: {
        id: true,
        status: true,
        total_amount: true,
        provider_refund_id: true,
      },
    });

    if (!refund) {
      logger.error("Refund for provider callback was not found", {
        refundId,
        refundKey,
        paymentId,
        provider,
        tag: logTag,
      });
      return null;
    }

    const refundAmountCents = Math.round(refund.total_amount.toNumber() * 100);
    if (refundAmountCents !== amountCents) {
      logger.error("Refund callback amount does not match stored refund", {
        refundId: refund.id,
        paymentId,
        provider,
        expectedAmountCents: refundAmountCents,
        callbackAmountCents: amountCents,
        tag: logTag,
      });
    }

    if (result === "failed") {
      await tx.refund.updateMany({
        where: {
          id: refund.id,
          status: { in: ["PENDING", "PROCESSING", "REQUIRES_MANUAL_REVIEW"] },
        },
        data: {
          status: "FAILED",
          ...(paymentId ? { provider_refund_id: paymentId } : {}),
          failure_reason: "Payment provider refund callback reported failure",
        },
      });
      return refund;
    }

    const update = await tx.refund.updateMany({
      where: {
        id: refund.id,
        status: { in: ["PENDING", "PROCESSING", "REQUIRES_MANUAL_REVIEW"] },
      },
      data: {
        status: "SUCCEEDED",
        ...(paymentId ? { provider_refund_id: paymentId } : {}),
      },
    });

    if (update.count === 0) {
      logger.info("Received refund callback for already reconciled refund", {
        refundId: refund.id,
        paymentId,
        provider,
        status: refund.status,
        tag: logTag,
      });
      return refund;
    }

    await enqueueOrderRefundSucceededSideEffectJobs({
      refundId: refund.id,
      transaction: tx,
      enqueueJob,
    });

    return refund;
  });
};

export const handlePaymentReconciliation = async (event: PaymentReconciliationEvent) => {
  Sentry.getCurrentScope().setContext("order", {
    orderId: event.orderId,
    paymentId: event.paymentId,
    provider: event.provider,
  });

  const reconcileResult = await reconcileOrder(event);

  if (!reconcileResult) {
    return;
  }
};

export const handleRefundReconciliation = async (event: RefundReconciliationEvent) => {
  Sentry.getCurrentScope().setContext("order", {
    refundId: event.refundId,
    refundKey: event.refundKey,
    paymentId: event.paymentId,
    provider: event.provider,
  });

  await reconcileRefund(event);
};
