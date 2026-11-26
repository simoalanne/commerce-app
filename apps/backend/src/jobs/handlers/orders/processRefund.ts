import { and, eq } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import { orderTable, refundTable } from "#src/db/schema.ts";
import { getPaymentProvider } from "#src/integrations/payments/payment.provider.ts";
import { enqueueOrderRefundSucceededSideEffectJobs } from "#src/integrations/payments/payment.reconciliation.ts";
import type { JobHandlerContext } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";

type ProcessRefundPayload = {
  refundId: number;
};

export async function processRefund(
  { refundId }: ProcessRefundPayload,
  { jobQueue }: JobHandlerContext,
) {
  const [claimedRefund] = await db
    .update(refundTable)
    .set({ status: "PROCESSING" })
    .where(and(eq(refundTable.id, refundId), eq(refundTable.status, "PENDING")))
    .returning({
      id: refundTable.id,
      idempotencyKey: refundTable.idempotencyKey,
      totalAmountCents: refundTable.totalAmountCents,
      orderId: refundTable.orderId,
    });
  const refund = claimedRefund && {
    ...claimedRefund,
    order: (
      await db
        .select({
          id: orderTable.id,
          paymentId: orderTable.paymentId,
          paymentProvider: orderTable.paymentProvider,
          orderDetails: orderTable.orderDetails,
        })
        .from(orderTable)
        .where(eq(orderTable.id, claimedRefund.orderId))
    )[0],
  };

  if (!refund) {
    logger.info("Skipping refund processing because refund is not pending", {
      tag: "process-refund-job",
      refundId,
    });
    return;
  }

  if (!refund.order.paymentId) {
    throw new Error("REFUND_ORDER_PAYMENT_ID_MISSING");
  }

  const orderDetails = refund.order.orderDetails;
  const refundedPayment = await getPaymentProvider(refund.order.paymentProvider).refundPayment({
    paymentId: refund.order.paymentId,
    amountCents: refund.totalAmountCents,
    receiptEmail: orderDetails.customer.email,
    orderId: refund.order.id,
    refundId: refund.id,
    refundKey: refund.idempotencyKey,
  });

  if (refundedPayment.status === "failed") {
    await db
      .update(refundTable)
      .set({ status: "FAILED", failureReason: refundedPayment.reason })
      .where(eq(refundTable.id, refund.id));
    return;
  }

  if (refundedPayment.status === "requires_manual_review") {
    await db
      .update(refundTable)
      .set({ status: "REQUIRES_MANUAL_REVIEW", failureReason: refundedPayment.reason })
      .where(eq(refundTable.id, refund.id));
    return;
  }

  if (refundedPayment.status === "succeeded") {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(refundTable)
        .set({ status: "SUCCEEDED", providerRefundId: refundedPayment.refundId })
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
      .set({ providerRefundId: refundedPayment.refundId })
      .where(eq(refundTable.id, refund.id));

    logger.info("Refund is pending provider confirmation", {
      tag: "process-refund-job",
      refundId: refund.id,
      providerRefundId: refundedPayment.refundId,
    });
  }
}
