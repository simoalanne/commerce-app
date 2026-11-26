import { renderMjmlTemplate } from "#src/integrations/email/renderMjmlTemplate.ts";
import type { OrderRefundedPayload } from "#src/jobs/handlers/orders/buildOrderRefundedPayload.ts";

import { formatCurrency, formatLine, getInitials } from "./emailHelpers.ts";

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
  const totalFormatted = formatCurrency(payload.total, locale);

  const refundLines = payload.items.map((item) => ({
    name: item.name,
    initials: getInitials(item.name),
    imageUrl: item.imageUrl,
    imageAlt: formatLine(t.productImageAlt, { name: item.name }),
    lineItem: formatLine(t.lineItem, {
      quantity: item.quantity,
      unitPrice: formatCurrency(item.unitPrice, locale),
    }),
    vendor: item.vendorName,
    total: formatCurrency(item.lineTotal, locale),
  }));

  const itemLines = payload.items.flatMap((item) => {
    const lines = [
      `- ${item.name}`,
      `  ${formatLine(t.lineItem, {
        quantity: item.quantity,
        unitPrice: formatCurrency(item.unitPrice, locale),
      })}`,
      `  ${formatCurrency(item.lineTotal, locale)}`,
    ];

    if (item.vendorName) {
      lines.push(`  ${item.vendorName}`);
    }

    return lines;
  });
  const detailLines = itemLines;

  const html = await renderMjmlTemplate("order-refund-confirmation.mjml", {
    subject,
    preview: t.preview,
    intro,
    brand: {
      name: t.brand,
    },
    detailsTitle: t.detailsTitle,
    refundLines,
    totals: {
      totalLabel: t.totalLabel,
      total: totalFormatted,
    },
    customer: {
      email: payload.recipientEmail,
    },
    helpText: formatLine(t.helpText, {
      email: `<a href="mailto:${contactEmail}">${contactEmail}</a>`,
    }),
    recipientLabel: `${t.recipient}:`,
  });

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
