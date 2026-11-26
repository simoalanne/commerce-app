import envConfig from "#src/config.ts";
import { getCompanyContactInformation } from "#src/domain/getCompanyDetails.ts";
import { EmailService } from "#src/integrations/email/email.provider.ts";
import { buildOrderRefundedPayload } from "#src/jobs/handlers/orders/buildOrderRefundedPayload.ts";
import logger from "#src/logger.ts";
import prismaClient from "#src/prisma.ts";
import { generateRefundReceiptPdf } from "#src/utils/pdf/generateRefundReceiptPdf.ts";

import { renderOrderRefundedEmail } from "./renderOrderRefundedEmail.tsx";

type SendOrderRefundedEmailPayload = {
  refundId: number;
};

export async function sendOrderRefundedEmail({ refundId }: SendOrderRefundedEmailPayload) {
  const payload = await buildOrderRefundedPayload(refundId);
  const email = await renderOrderRefundedEmail(
    payload,
    getCompanyContactInformation(envConfig).email,
  );
  const refundReceipt = await generateRefundReceiptPdf(
    { db: prismaClient, config: envConfig },
    {
      access: "internal",
      refundId,
      locale: payload.locale,
    },
  );

  logger.info("Sending order refund confirmation email", {
    tag: "order-refunded-email-job",
    orderId: payload.orderId,
    locale: payload.locale,
    subject: email.subject,
  });

  await EmailService.sendEmail({
    to: {
      email: payload.recipientEmail,
      name: payload.recipientName,
    },
    subject: email.subject,
    html: email.html,
    text: email.text,
    locale: payload.locale,
    tags: [
      { name: "event", value: "order.refunded" },
      { name: "template", value: "order-refunded-confirmation" },
    ],
    metadata: {
      orderId: payload.orderId.toString(),
      refundId: refundId.toString(),
      locale: payload.locale,
    },
    attachments: [
      {
        filename: refundReceipt.filename,
        content: Buffer.from(refundReceipt.body),
      },
    ],
    idempotencyKey: `order-refunded-confirmation-${refundId}`,
  });
}
