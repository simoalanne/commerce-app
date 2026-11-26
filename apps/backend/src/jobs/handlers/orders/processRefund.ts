import * as Sentry from "@sentry/node";

import { getPaymentProvider } from "#src/integrations/payments/payment.provider.ts";
import { enqueueOrderRefundSucceededSideEffectJobs } from "#src/jobs/handlers/jobAggregrates.ts";
import type { JobHandlerContext } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";
import prismaClient from "#src/prisma.ts";

type ProcessRefundPayload = {
  refundId: number;
};

export async function processRefund(
  { refundId }: ProcessRefundPayload,
  { runAppTransaction }: JobHandlerContext,
) {
  Sentry.getCurrentScope().setContext("refund", { refundId });

  const [refund] = await prismaClient.refund.updateManyAndReturn({
    where: {
      id: refundId,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
    },
    select: {
      id: true,
      idempotency_key: true,
      total_amount: true,
      order: {
        select: {
          id: true,
          payment_id: true,
          payment_provider: true,
          order_details: true,
        },
      },
    },
  });

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

  const orderDetails = refund.order.order_details as PrismaJson.OrderDetails;
  const refundedPayment = await getPaymentProvider(refund.order.payment_provider).refundPayment({
    paymentId: refund.order.payment_id,
    amountCents: Math.round(refund.total_amount.toNumber() * 100),
    receiptEmail: orderDetails.customer.email,
    orderId: refund.order.id,
    refundId: refund.id,
    refundKey: refund.idempotency_key,
  });

  if (refundedPayment.status === "failed") {
    await prismaClient.refund.update({
      where: { id: refund.id },
      data: {
        status: "FAILED",
        failure_reason: refundedPayment.reason,
      },
    });
    return;
  }

  if (refundedPayment.status === "requires_manual_review") {
    await prismaClient.refund.update({
      where: { id: refund.id },
      data: {
        status: "REQUIRES_MANUAL_REVIEW",
        failure_reason: refundedPayment.reason,
      },
    });
    return;
  }

  if (refundedPayment.status === "succeeded") {
    await runAppTransaction(async ({ tx, enqueueJob }) => {
      const update = await tx.refund.updateMany({
        where: {
          id: refund.id,
          status: "PROCESSING",
        },
        data: {
          status: "SUCCEEDED",
          provider_refund_id: refundedPayment.refundId,
        },
      });

      if (update.count === 0) {
        logger.info("Skipping refund succeeded side effects", {
          tag: "process-refund-job",
          refundId: refund.id,
        });
        return;
      }

      await enqueueOrderRefundSucceededSideEffectJobs({
        refundId: refund.id,
        enqueueJob,
        transaction: tx,
      });
    });
    return;
  }

  if (refundedPayment.status === "pending") {
    await prismaClient.refund.update({
      where: { id: refund.id },
      data: {
        provider_refund_id: refundedPayment.refundId,
      },
    });

    logger.info("Refund is pending provider confirmation", {
      tag: "process-refund-job",
      refundId: refund.id,
      providerRefundId: refundedPayment.refundId,
    });
  }
}
