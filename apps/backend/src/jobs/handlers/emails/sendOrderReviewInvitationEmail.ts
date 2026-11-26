import envConfig from "#src/config.ts";
import { EmailService } from "#src/integrations/email/email.provider.ts";
import logger from "#src/logger.ts";
import prismaClient from "#src/prisma.ts";
import { getOnlineStoreUrl } from "#src/utils/getOnlineStoreUrl.ts";

import { renderOrderReviewInvitationEmail } from "./renderOrderReviewInvitationEmail.ts";

type SendOrderReviewInvitationEmailPayload = {
  orderId: number;
};

const getReviewOrderEmailScheduledAt = () => {
  const delay = envConfig.REVIEW_ORDER_EMAIL_DELAY.trim();

  if (!delay || delay === "0") {
    return undefined;
  }

  return delay;
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
  const order = await prismaClient.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      claim_token: true,
      preferred_locale: true,
      order_details: true,
    },
  });

  if (order.status !== "DELIVERED") {
    logger.warn("Skipping order review invitation for non-delivered order", {
      tag: "order-review-invitation-email-job",
      orderId,
      status: order.status,
    });
    return;
  }

  const orderDetails = order.order_details;
  const locale = order.preferred_locale ?? "en";
  const recipientName = orderDetails.customer.name;
  const reviewUrl = buildReviewOrderUrl({
    baseUrl: getOnlineStoreUrl(envConfig, "/"),
    locale,
    orderId,
    claimToken: order.claim_token,
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
      { name: "event", value: "order.delivered" },
      { name: "template", value: "order-review-invitation" },
    ],
    scheduledAt: getReviewOrderEmailScheduledAt(),
    metadata: {
      orderId: String(orderId),
      locale,
    },
    idempotencyKey: `order-review-invitation-${orderId}`,
  });
}
