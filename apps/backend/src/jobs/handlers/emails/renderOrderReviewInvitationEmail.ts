import { renderMjmlTemplate } from "#src/integrations/email/renderMjmlTemplate.ts";

type OrderReviewInvitationEmailPayload = {
  orderId: number;
  recipientName: string;
  reviewUrl: string;
  locale: string;
};

const copy = {
  en: {
    subject: "How was your order?",
    eyebrow: "Acme",
    title: "Your order has been delivered",
    body: "Thank you for your order, {name}. We'd love to hear what you thought about the products, the vendors and the store. Your feedback helps us improve.",
    ctaLabel: "Review your order",
    linkFallback: "If the button does not work, open this link:",
  },
} as const;

const getLocaleCopy = (locale: string) => copy[locale as keyof typeof copy] ?? copy.en;

export async function renderOrderReviewInvitationEmail(payload: OrderReviewInvitationEmailPayload) {
  const localizedCopy = getLocaleCopy(payload.locale);
  const body = localizedCopy.body.replace("{name}", payload.recipientName);
  const html = await renderMjmlTemplate("order-review-invitation.mjml", {
    subject: localizedCopy.subject,
    eyebrow: localizedCopy.eyebrow,
    title: localizedCopy.title,
    body,
    ctaLabel: localizedCopy.ctaLabel,
    linkFallback: localizedCopy.linkFallback,
    reviewUrl: payload.reviewUrl,
  });

  return {
    subject: localizedCopy.subject,
    html,
    text: `${localizedCopy.title}\n\n${body}\n\n#${payload.orderId}\n${payload.reviewUrl}`,
  };
}
