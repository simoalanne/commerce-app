import { render } from "@react-email/components";

import type { OrderRefundedPayload } from "#src/jobs/handlers/orders/buildOrderRefundedPayload.ts";

import {
  ContactFooter,
  EmailLayout,
  EmailSection,
  ItemRows,
  TotalsTable,
} from "./emailComponents.tsx";
import { formatCents, formatLine, getInitials } from "./emailHelpers.ts";

type OrderRefundedEmailContent = {
  subject: string;
  html: string;
  text: string;
};

const translations = {
  en: {
    subject: "Refund confirmation for order #{orderId}",
    intro: "Hi {name}, we've processed a refund for order #{orderId}.",
    brand: "Acme",
    detailsTitle: "Refund details",
    lineItem: "Qty {quantity} • {unitPrice} each",
    totalLabel: "Refunded amount",
    productImageAlt: "Product image for {name}",
    helpText: "If you have any questions, reply to this email or contact us at {email}.",
    recipient: "Recipient",
    preview: "Refund confirmation for your order",
  },
} as const;

const getTranslation = (locale: string) =>
  translations[locale as keyof typeof translations] ?? translations.en;

export async function renderOrderRefundedEmail(
  payload: OrderRefundedPayload,
  contactEmail: string,
): Promise<OrderRefundedEmailContent> {
  const locale = payload.locale;
  const t = getTranslation(locale);
  const subject = formatLine(t.subject, { orderId: payload.orderId });
  const intro = formatLine(t.intro, {
    name: payload.recipientFirstName,
    orderId: payload.orderId,
  });
  const totalFormatted = formatCents(payload.totalCents, locale);

  const refundLines = payload.items.map((item) => ({
    name: item.name,
    initials: getInitials(item.name),
    imageUrl: item.imageUrl,
    imageAlt: formatLine(t.productImageAlt, { name: item.name }),
    lineItem: formatLine(t.lineItem, {
      quantity: item.quantity,
      unitPrice: formatCents(item.unitPriceCents, locale),
    }),
    vendor: item.vendorName,
    total: formatCents(item.lineTotalCents, locale),
  }));

  const itemLines = payload.items.flatMap((item) => {
    const lines = [
      `- ${item.name}`,
      `  ${formatLine(t.lineItem, {
        quantity: item.quantity,
        unitPrice: formatCents(item.unitPriceCents, locale),
      })}`,
      `  ${formatCents(item.lineTotalCents, locale)}`,
    ];

    if (item.vendorName) {
      lines.push(`  ${item.vendorName}`);
    }

    return lines;
  });
  const detailLines = itemLines;

  const html = await render(
    <EmailLayout
      subject={subject}
      preview={t.preview}
      eyebrow={t.brand}
      title={subject}
      intro={intro}
    >
      {refundLines.length > 0 ? (
        <EmailSection label={t.detailsTitle}>
          <ItemRows items={refundLines} />
        </EmailSection>
      ) : null}
      <EmailSection>
        <TotalsTable total={{ label: t.totalLabel, value: totalFormatted }} />
      </EmailSection>
      <ContactFooter
        helpText={t.helpText}
        contactEmail={contactEmail}
        recipientLabel={`${t.recipient}:`}
        recipientEmail={payload.recipientEmail}
      />
    </EmailLayout>,
  );

  const text = [
    subject,
    "",
    intro,
    "",
    ...(detailLines.length > 0 ? [t.detailsTitle, ...detailLines, ""] : []),
    `${t.totalLabel}: ${totalFormatted}`,
    "",
    t.helpText.replace("{email}", contactEmail),
    `${t.recipient}: ${payload.recipientEmail}`,
  ].join("\n");

  return { subject, html, text };
}
