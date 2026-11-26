import * as Sentry from "@sentry/node";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db, type Db } from "#src/db/client.ts";
import type { OrderDetails } from "#src/db/json.ts";
import {
  type OrderStatus,
  orderItemTable,
  orderTable,
  promotionCodeTable,
  refundTable,
} from "#src/db/schema.ts";
import {
  commitAsMuchStockAsPossible,
  commitReservedStock,
  releaseReservedStock,
} from "#src/features/customer-api/checkout/checkout.adjustStock.ts";
import {
  enqueueOrderRefundSucceededSideEffectJobs,
  enqueueProductStockInvalidationJobs,
} from "#src/jobs/handlers/jobAggregrates.ts";
import { type EnqueueJob, jobQueue } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";

import type { PaymentProviderName } from "./payment.provider.ts";

type PendingOrderState = {
  previousStatus: OrderStatus;
  updated: boolean;
  orderDetails: OrderDetails;
  appliedPromoCode: string | null;
};

const getOrderStockAdjustments = async ({
  orderId,
  transaction,
}: {
  orderId: number;
  transaction: Db;
}) =>
  transaction.query.orderItem.findMany({
    where: { orderId },
    columns: {
      id: true,
      sku: true,
      quantity: true,
      productId: true,
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
  transaction: Db;
  enqueueJob: EnqueueJob;
}) => {
  await enqueueJob({
    type: "sendOrderConfirmationEmail",
    payload: { orderId },
  });

  await enqueueJob({
    type: "sendNewOrderNotificationEmail",
    payload: { orderId },
  });

  const subscribers = await transaction.query.webhookSubscription.findMany({
    where: { event: "order.paid" },
    columns: { url: true },
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
  transaction: Db;
}) => {
  const {
    rows: [state],
  } = await transaction.execute<PendingOrderState>(sql`
		WITH current AS (
			SELECT status, order_details, applied_promo_code
			FROM ${orderTable}
			WHERE id = ${orderId}
			FOR UPDATE
		),
		updated AS (
			UPDATE ${orderTable}
			SET status = ${status}::order_status,
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
	`);

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
  transaction: Db;
  enqueueJob: EnqueueJob;
}) => {
  const [recoveredOrder] = await transaction
    .update(orderTable)
    .set({
      status: "PAID",
      paymentId,
      paidAt: new Date(),
    })
    .where(eq(orderTable.id, orderId))
    .returning({
      orderDetails: orderTable.orderDetails,
      appliedPromoCode: orderTable.appliedPromoCode,
    });
  const orderItems = await getOrderStockAdjustments({ orderId, transaction });

  const shortfalls = await commitAsMuchStockAsPossible({
    items: orderItems,
    transaction,
  });

  for (const orderItem of orderItems) {
    const uncommittedQuantity = shortfalls.find(
      (shortfall) => shortfall.sku === orderItem.sku,
    )?.uncommittedQuantity;

    if (!uncommittedQuantity) {
      continue;
    }

    await transaction
      .update(orderItemTable)
      .set({ uncommittedQuantity })
      .where(eq(orderItemTable.id, orderItem.id));
  }

  await incrementPromoCodeUsage({
    promoCode: recoveredOrder.appliedPromoCode,
    transaction,
  });
  await enqueueProductStockInvalidationJobs({
    productIds: orderItems.flatMap((item) => (item.productId == null ? [] : [item.productId])),
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
    orderDetails: recoveredOrder.orderDetails,
    appliedPromoCode: recoveredOrder.appliedPromoCode,
  };
};

const incrementPromoCodeUsage = async ({
  promoCode,
  transaction,
}: {
  promoCode: string | null;
  transaction: Db;
}) => {
  if (!promoCode) {
    return;
  }

  await transaction
    .update(promotionCodeTable)
    .set({ timesUsed: sql`${promotionCodeTable.timesUsed} + 1` })
    .where(eq(promotionCodeTable.code, promoCode));
};

const expirePendingOrder = async ({ orderId, paymentId, provider }: PaymentReconciliationEvent) => {
  const targetStatus: OrderStatus = "EXPIRED";
  const logTag = `${provider.toLowerCase()}-payment-reconciliation`;

  return await db.transaction(async (tx) => {
    const enqueueJob: EnqueueJob = (job) => jobQueue.enqueue(tx, job);
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
      productIds: orderItems.flatMap((item) => (item.productId == null ? [] : [item.productId])),
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

  return await db.transaction(async (tx) => {
    const enqueueJob: EnqueueJob = (job) => jobQueue.enqueue(tx, job);
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

    await tx.update(orderTable).set({ paidAt: new Date() }).where(eq(orderTable.id, orderId));

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

const unreconciledRefund = (refundId: number) =>
  and(
    eq(refundTable.id, refundId),
    inArray(refundTable.status, ["PENDING", "PROCESSING", "REQUIRES_MANUAL_REVIEW"]),
  );

export const reconcileRefund = async ({
  refundId,
  refundKey,
  paymentId,
  provider,
  amountCents,
  result,
}: RefundReconciliationEvent) => {
  const logTag = `${provider.toLowerCase()}-refund-reconciliation`;

  return await db.transaction(async (tx) => {
    const enqueueJob: EnqueueJob = (job) => jobQueue.enqueue(tx, job);
    const refundMatches = [
      ...(paymentId ? [{ providerRefundId: paymentId }] : []),
      ...(refundId ? [{ id: refundId }] : []),
      ...(refundKey ? [{ idempotencyKey: refundKey }] : []),
    ];
    // An empty OR throws in Drizzle; with nothing to match, there is no refund.
    const refund =
      refundMatches.length === 0
        ? undefined
        : await tx.query.refund.findFirst({
            where: { OR: refundMatches },
            columns: {
              id: true,
              status: true,
              totalAmountCents: true,
              providerRefundId: true,
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

    const refundAmountCents = refund.totalAmountCents;
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
      await tx
        .update(refundTable)
        .set({
          status: "FAILED",
          ...(paymentId ? { providerRefundId: paymentId } : {}),
          failureReason: "Payment provider refund callback reported failure",
        })
        .where(unreconciledRefund(refund.id));
      return refund;
    }

    const updated = await tx
      .update(refundTable)
      .set({
        status: "SUCCEEDED",
        ...(paymentId ? { providerRefundId: paymentId } : {}),
      })
      .where(unreconciledRefund(refund.id))
      .returning({ id: refundTable.id });

    if (updated.length === 0) {
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
