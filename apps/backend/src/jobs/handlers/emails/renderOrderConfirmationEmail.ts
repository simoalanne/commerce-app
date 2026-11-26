import { renderMjmlTemplate } from "#src/integrations/email/renderMjmlTemplate.ts";

import { formatCurrency, formatLine, getInitials } from "./emailHelpers.ts";

type OrderConfirmationEmailPayload = {
  orderId: number;
  recipientEmail: string;
  recipientName: string;
  recipientFirstName: string;
  formattedAddress: string;
  items: {
    name: string;
    vendorName: string | null;
    imageUrl: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  tipAmount: number;
  total: number;
  vatRate: number;
  includedVatAmount: number;
  viewOrderUrl: string;
  locale: string;
};

const translations = {
  en: {
    subject: "Your order #{orderId} is confirmed",
    intro: "Thanks{name}, your order is confirmed. Here is your receipt",
    brand: "Acme",
    deliveryTitle: "Delivery",
    order: "Order",
    deliveryAddress: "Delivery address",
    yourOrder: "Your order",
    subtotal: "Subtotal",
    deliveryFee: "Delivery fee",
    lineItem: "Qty {quantity} • {unitPrice} each",
    tip: "Tip",
    total: "Total",
    includedVat: "Includes VAT {rate}%",
    viewOrder: "View your order",
    or: "or",
    visitShop: "Visit our shop",
    linkFallback: "If the button does not work, open this link:",
    receiptNote:
      "This message focuses on your order details and delivery. You will receive a separate receipt from our payment provider for your payment.",
    recipient: "Recipient",
    helpText: "If you have any questions, reply to this email or contact us at {email}.",
    productImageAlt: "Product image for {name}",
    preview: "Your receipt, delivery details, and next steps",
  },
} as const;

const getTranslation = (locale: string) =>
  translations[locale as keyof typeof translations] ?? translations.en;

export async function renderOrderConfirmationEmail(
  payload: OrderConfirmationEmailPayload,
  contactEmail: string,
) {
  const locale = payload.locale;
  const t = getTranslation(locale);
  const subject = formatLine(t.subject, {
    orderId: payload.orderId,
  });
  const intro = formatLine(t.intro, {
    name: ` ${payload.recipientFirstName}`,
  });
  const addressLines = [
    payload.recipientName,
    ...payload.formattedAddress.split("\n").filter(Boolean),
  ];
  const shopUrl = new URL(`/${locale}`, payload.viewOrderUrl).toString();

  const html = await renderMjmlTemplate("order-confirmation.mjml", {
    subject,
    preview: t.preview,
    intro,
    brand: {
      name: t.brand,
    },
    customer: {
      email: payload.recipientEmail,
    },
    delivery: {
      title: t.deliveryTitle,
      addressLabel: t.deliveryAddress,
      addressLines,
    },
    itemsTitle: t.yourOrder,
    items: payload.items.map((item) => ({
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
    })),
    totals: {
      subtotalLabel: t.subtotal,
      subtotal: formatCurrency(payload.subtotal, locale),
      deliveryFeeLabel: t.deliveryFee,
      deliveryFee: formatCurrency(payload.deliveryFee, locale),
      tipLabel: t.tip,
      tip: payload.tipAmount ? formatCurrency(payload.tipAmount, locale) : null,
      totalLabel: t.total,
      total: formatCurrency(payload.total, locale),
      includedVatLabel: formatLine(t.includedVat, {
        rate: payload.vatRate,
      }),
      includedVat: formatCurrency(payload.includedVatAmount, locale),
    },
    orderUrl: payload.viewOrderUrl,
    viewOrderLabel: t.viewOrder,
    shopUrl,
    shopLinkPrefix: t.or,
    shopLinkLabel: t.visitShop,
    helpText: formatLine(t.helpText, {
      email: `<a href="mailto:${contactEmail}">${contactEmail}</a>`,
    }),
    paymentReceiptText: t.receiptNote,
    recipientLabel: `${t.recipient}:`,
  });

  const itemLines = payload.items.flatMap((item) => {
    const lines = [
      `- ${item.name}`,
      `  ${formatLine(t.lineItem, {
        quantity: item.quantity,
        unitPrice: formatCurrency(item.unitPrice, locale),
      })}`,
      `  ${t.total}: ${formatCurrency(item.lineTotal, locale)}`,
    ];

    if (item.vendorName) {
      lines.push(`  ${item.vendorName}`);
    }

    return lines;
  });

  const text = [
    subject,
    "",
    intro,
    "",
    `${t.order}: #${payload.orderId}`,
    "",
    t.deliveryAddress,
    ...addressLines,
    "",
    t.yourOrder,
    ...itemLines,
    "",
    `${t.subtotal}: ${formatCurrency(payload.subtotal, locale)}`,
    `${t.deliveryFee}: ${formatCurrency(payload.deliveryFee, locale)}`,
    ...(payload.tipAmount ? [`${t.tip}: ${formatCurrency(payload.tipAmount, locale)}`] : []),
    `${t.total}: ${formatCurrency(payload.total, locale)}`,
    `${formatLine(t.includedVat, { rate: payload.vatRate })}: ${formatCurrency(payload.includedVatAmount, locale)}`,
    "",
    t.viewOrder,
    payload.viewOrderUrl,
    "",
    t.linkFallback,
    payload.viewOrderUrl,
    "",
    t.receiptNote,
    `${t.recipient}: ${payload.recipientEmail}`,
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
