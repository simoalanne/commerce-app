import envConfig from "#src/config.ts";
import { db } from "#src/db/client.ts";
import { EmailService } from "#src/integrations/email/email.provider.ts";
import logger from "#src/logger.ts";
import { getOnlineStoreUrl } from "#src/utils/getOnlineStoreUrl.ts";

import { renderOrderReviewInvitationEmail } from "./renderOrderReviewInvitationEmail.tsx";

type SendOrderReviewInvitationEmailPayload = {
  orderId: number;
};

const buildReviewOrderUrl = ({
  baseUrl,
  locale,
  orderId,
  claimToken,
}: {
  baseUrl: string;
  locale: string;
  orderId: number;
  claimToken: string;
}) => {
  const url = new URL(
    `/${locale}/review-order/access-token`,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  );
  url.searchParams.set("orderId", String(orderId));
  url.searchParams.set("token", claimToken);
  return url.toString();
};

export async function sendOrderReviewInvitationEmail({
  orderId,
}: SendOrderReviewInvitationEmailPayload) {
  const order = await db.query.order.findFirst({
    where: { id: orderId },
    columns: {
      id: true,
      status: true,
      claimToken: true,
      preferredLocale: true,
      orderDetails: true,
    },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  if (order.status !== "SHIPPED") {
    logger.warn("Skipping order review invitation for an order that has not shipped", {
      tag: "order-review-invitation-email-job",
      orderId,
      status: order.status,
    });
    return;
  }

  const orderDetails = order.orderDetails;
  const locale = order.preferredLocale ?? "en";
  const recipientName = orderDetails.customer.name;
  const reviewUrl = buildReviewOrderUrl({
    baseUrl: getOnlineStoreUrl(envConfig, "/"),
    locale,
    orderId,
    claimToken: order.claimToken,
  });
  const email = await renderOrderReviewInvitationEmail({
    orderId,
    recipientName,
    reviewUrl,
    locale,
  });

  logger.info("Sending order review invitation email", {
    tag: "order-review-invitation-email-job",
    orderId,
    locale,
    subject: email.subject,
  });

  await EmailService.sendEmail({
    to: {
      email: orderDetails.customer.email,
      name: recipientName,
    },
    subject: email.subject,
    html: email.html,
    text: email.text,
    locale,
    tags: [
      { name: "event", value: "order.shipped" },
      { name: "template", value: "order-review-invitation" },
    ],
    metadata: {
      orderId: String(orderId),
      locale,
    },
    idempotencyKey: `order-review-invitation-${orderId}`,
  });
}
