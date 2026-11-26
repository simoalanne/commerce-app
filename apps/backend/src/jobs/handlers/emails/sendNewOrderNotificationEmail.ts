import envConfig from "#src/config.ts";
import { getCompanyContactInformation } from "#src/domain/getCompanyDetails.ts";
import { EmailService } from "#src/integrations/email/email.provider.ts";
import { buildOrderPaidPayload } from "#src/jobs/handlers/orders/buildOrderPaidPayload.ts";
import logger from "#src/logger.ts";

import { renderNewOrderNotificationEmail } from "./renderNewOrderNotificationEmail.tsx";

type SendNewOrderNotificationEmailPayload = {
  orderId: number;
};

const getDashboardOrdersUrl = () => {
  if (!envConfig.DASHBOARD_URL) {
    throw new Error(
      "Missing DASHBOARD_URL environment variable, which is required to generate dashboard order links",
    );
  }

  return new URL("/orders", envConfig.DASHBOARD_URL).toString();
};

export async function sendNewOrderNotificationEmail({
  orderId,
}: SendNewOrderNotificationEmailPayload) {
  if (!envConfig.NEW_ORDER_NOTIFICATION_EMAIL_ENABLED) {
    logger.info("Skipping new order notification email because it is disabled", {
      tag: "new-order-notification-email-job",
      orderId,
    });

    return;
  }

  const order = await buildOrderPaidPayload(orderId);
  const email = await renderNewOrderNotificationEmail({
    orderId: order.orderId,
    placedAt: order.placedAt,
    customer: {
      name: order.recipientName,
      email: order.recipientEmail,
      phone: null,
    },
    formattedAddress: order.formattedAddress,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total,
    dashboardOrderUrl: getDashboardOrdersUrl(),
  });

  logger.info("Sending new order notification email", {
    tag: "new-order-notification-email-job",
    orderId: order.orderId,
    subject: email.subject,
  });

  const companyContact = getCompanyContactInformation(envConfig);

  await EmailService.sendEmail({
    to: {
      email: companyContact.email,
      name: "Acme",
    },
    subject: email.subject,
    html: email.html,
    text: email.text,
    tags: [
      { name: "event", value: "order.paid" },
      { name: "template", value: "new-order-notification" },
    ],
    metadata: {
      orderId: order.orderId.toString(),
    },
    idempotencyKey: `new-order-notification-${order.orderId}`,
  });
}
