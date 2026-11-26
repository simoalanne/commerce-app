import { render } from "@react-email/components";

import { EmailLayout, EmailSection, MutedText, UrlLink } from "./emailComponents.tsx";

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
  const html = await render(
    <EmailLayout
      subject={localizedCopy.subject}
      preview={localizedCopy.title}
      eyebrow={localizedCopy.eyebrow}
      title={localizedCopy.title}
      action={{ href: payload.reviewUrl, label: localizedCopy.ctaLabel }}
    >
      <EmailSection>
        <MutedText size={15}>{body}</MutedText>
      </EmailSection>
      <EmailSection>
        <MutedText>{localizedCopy.linkFallback}</MutedText>
        <UrlLink href={payload.reviewUrl} />
      </EmailSection>
    </EmailLayout>,
  );

  return {
    subject: localizedCopy.subject,
    html,
    text: `${localizedCopy.title}\n\n${body}\n\n#${payload.orderId}\n${payload.reviewUrl}`,
  };
}
