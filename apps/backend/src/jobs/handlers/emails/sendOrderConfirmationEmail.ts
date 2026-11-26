import envConfig from "#src/config.ts";
import { getCompanyContactInformation } from "#src/domain/getCompanyDetails.ts";
import { EmailService } from "#src/integrations/email/email.provider.ts";
import { buildOrderPaidPayload } from "#src/jobs/handlers/orders/buildOrderPaidPayload.ts";
import logger from "#src/logger.ts";
import prismaClient from "#src/prisma.ts";
import { generateOrderInvoicePdf } from "#src/utils/pdf/generateOrderInvoicePdf.ts";

import { renderOrderConfirmationEmail } from "./renderOrderConfirmationEmail.tsx";

type SendOrderConfirmationEmailPayload = {
  orderId: number;
};

export async function sendOrderConfirmationEmail({ orderId }: SendOrderConfirmationEmailPayload) {
  const payload = await buildOrderPaidPayload(orderId);
  const email = await renderOrderConfirmationEmail(
    payload,
    getCompanyContactInformation(envConfig).email,
  );
  const invoice = await generateOrderInvoicePdf(
    { db: prismaClient, config: envConfig },
    {
      access: "internal",
      orderId: payload.orderId,
    },
  );

  logger.info("Sending order confirmation email", {
    tag: "order-confirmation-email-job",
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
      { name: "event", value: "order.paid" },
      { name: "template", value: "order-confirmation" },
    ],
    metadata: {
      orderId: payload.orderId.toString(),
      locale: payload.locale,
    },
    attachments: [
      {
        filename: invoice.filename,
        content: Buffer.from(invoice.body),
      },
    ],
    idempotencyKey: `order-confirmation-${payload.orderId}`,
  });
}
