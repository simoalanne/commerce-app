import {
  formatShippingAddressLines,
  type ShippingAddress,
} from "@acme/shared/schemas/shippingAddress";
import { render } from "@react-email/components";

import {
  AddressBlock,
  ContactFooter,
  EmailLayout,
  EmailSection,
  ItemRows,
  MutedText,
  TotalsTable,
  UrlLink,
} from "./emailComponents.tsx";
import { formatCents, formatLine, getInitials } from "./emailHelpers.ts";

type OrderConfirmationEmailPayload = {
  orderId: number;
  recipientEmail: string;
  recipientName: string;
  recipientFirstName: string;
  shippingAddress: ShippingAddress;
  items: {
    name: string;
    vendorName: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  totalCents: number;
  vatRate: number;
  includedVatCents: number;
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
    lineItem: "Qty {quantity} • {unitPrice} each",
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
    ...formatShippingAddressLines(payload.shippingAddress),
  ];
  const shopUrl = new URL(`/${locale}`, payload.viewOrderUrl).toString();

  const html = await render(
    <EmailLayout
      subject={subject}
      preview={t.preview}
      eyebrow={t.brand}
      title={subject}
      intro={intro}
      action={{ href: payload.viewOrderUrl, label: t.viewOrder }}
      headerLink={{ prefix: t.or, href: shopUrl, label: t.visitShop }}
    >
      <EmailSection label={t.deliveryTitle}>
        <AddressBlock label={t.deliveryAddress} lines={addressLines} />
      </EmailSection>
      <EmailSection label={t.yourOrder}>
        <ItemRows
          items={payload.items.map((item) => ({
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
          }))}
        />
        <TotalsTable
          rows={[{ label: t.subtotal, value: formatCents(payload.subtotalCents, locale) }]}
          total={{ label: t.total, value: formatCents(payload.totalCents, locale) }}
          footnote={{
            label: formatLine(t.includedVat, { rate: payload.vatRate }),
            value: formatCents(payload.includedVatCents, locale),
          }}
        />
      </EmailSection>
      <EmailSection>
        <MutedText>{t.receiptNote}</MutedText>
        <UrlLink href={payload.viewOrderUrl} />
      </EmailSection>
      <ContactFooter
        helpText={t.helpText}
        contactEmail={contactEmail}
        recipientLabel={`${t.recipient}:`}
        recipientEmail={payload.recipientEmail}
      />
    </EmailLayout>,
  );

  const itemLines = payload.items.flatMap((item) => {
    const lines = [
      `- ${item.name}`,
      `  ${formatLine(t.lineItem, {
        quantity: item.quantity,
        unitPrice: formatCents(item.unitPriceCents, locale),
      })}`,
      `  ${t.total}: ${formatCents(item.lineTotalCents, locale)}`,
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
    `${t.subtotal}: ${formatCents(payload.subtotalCents, locale)}`,
    `${t.total}: ${formatCents(payload.totalCents, locale)}`,
    `${formatLine(t.includedVat, { rate: payload.vatRate })}: ${formatCents(payload.includedVatCents, locale)}`,
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
