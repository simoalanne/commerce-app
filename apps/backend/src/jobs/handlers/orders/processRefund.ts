import * as Sentry from "@sentry/node";
import { and, eq } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import { orderTable, refundTable } from "#src/db/schema.ts";
import { getPaymentProvider } from "#src/integrations/payments/payment.provider.ts";
import { enqueueOrderRefundSucceededSideEffectJobs } from "#src/jobs/handlers/jobAggregrates.ts";
import type { JobHandlerContext } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";

type ProcessRefundPayload = {
  refundId: number;
};

export async function processRefund(
  { refundId }: ProcessRefundPayload,
  { jobQueue }: JobHandlerContext,
) {
  Sentry.getCurrentScope().setContext("refund", { refundId });

  const [claimedRefund] = await db
    .update(refundTable)
    .set({ status: "PROCESSING" })
    .where(and(eq(refundTable.id, refundId), eq(refundTable.status, "PENDING")))
    .returning({
      id: refundTable.id,
      idempotency_key: refundTable.idempotency_key,
      total_amount_cents: refundTable.total_amount_cents,
      order_id: refundTable.order_id,
    });
  const refund = claimedRefund && {
    ...claimedRefund,
    order: (
      await db
        .select({
          id: orderTable.id,
          payment_id: orderTable.payment_id,
          payment_provider: orderTable.payment_provider,
          order_details: orderTable.order_details,
        })
        .from(orderTable)
        .where(eq(orderTable.id, claimedRefund.order_id))
    )[0],
  };

  if (!refund) {
    logger.info("Skipping refund processing because refund is not pending", {
      tag: "process-refund-job",
      refundId,
    });
    return;
  }

  if (!refund.order.payment_id) {
    throw new Error("REFUND_ORDER_PAYMENT_ID_MISSING");
  }

  const orderDetails = refund.order.order_details;
  const refundedPayment = await getPaymentProvider(refund.order.payment_provider).refundPayment({
    paymentId: refund.order.payment_id,
    amountCents: refund.total_amount_cents,
    receiptEmail: orderDetails.customer.email,
    orderId: refund.order.id,
    refundId: refund.id,
    refundKey: refund.idempotency_key,
  });

  if (refundedPayment.status === "failed") {
    await db
      .update(refundTable)
      .set({ status: "FAILED", failure_reason: refundedPayment.reason })
      .where(eq(refundTable.id, refund.id));
    return;
  }

  if (refundedPayment.status === "requires_manual_review") {
    await db
      .update(refundTable)
      .set({ status: "REQUIRES_MANUAL_REVIEW", failure_reason: refundedPayment.reason })
      .where(eq(refundTable.id, refund.id));
    return;
  }

  if (refundedPayment.status === "succeeded") {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(refundTable)
        .set({ status: "SUCCEEDED", provider_refund_id: refundedPayment.refundId })
        .where(and(eq(refundTable.id, refund.id), eq(refundTable.status, "PROCESSING")))
        .returning({ id: refundTable.id });

      if (updated.length === 0) {
        logger.info("Skipping refund succeeded side effects", {
          tag: "process-refund-job",
          refundId: refund.id,
        });
        return;
      }

      await enqueueOrderRefundSucceededSideEffectJobs({
        refundId: refund.id,
        enqueueJob: (job) => jobQueue.enqueue(tx, job),
        transaction: tx,
      });
    });
    return;
  }

  if (refundedPayment.status === "pending") {
    await db
      .update(refundTable)
      .set({ provider_refund_id: refundedPayment.refundId })
      .where(eq(refundTable.id, refund.id));

    logger.info("Refund is pending provider confirmation", {
      tag: "process-refund-job",
      refundId: refund.id,
      providerRefundId: refundedPayment.refundId,
    });
  }
}
