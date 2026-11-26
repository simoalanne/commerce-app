import { render } from "@react-email/components";

import {
  AddressBlock,
  EmailLayout,
  EmailSection,
  FieldTable,
  ItemRows,
  MailLink,
  TotalsTable,
} from "./emailComponents.tsx";
import { formatCents, formatLine, getInitials } from "./emailHelpers.ts";

export type NewOrderNotificationEmailPayload = {
  orderId: number;
  placedAt: Date;
  customer: {
    name: string;
    email: string;
    phone: string | null;
  };
  formattedAddress: string;
  items: {
    name: string;
    vendorName: string | null;
    imageUrl: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  totalCents: number;
  dashboardOrderUrl: string;
};

type NewOrderNotificationEmailContent = {
  subject: string;
  html: string;
  text: string;
};

const copy = {
  subject: "New order #{orderId}",
  preview: "A new paid order is ready for processing",
  intro: "A new paid order is ready for processing.",
  brand: "Acme",
  orderTitle: "Order",
  orderNumber: "Order number",
  placedAt: "Placed at",
  customerTitle: "Customer",
  name: "Name",
  email: "Email",
  phone: "Phone",
  deliveryTitle: "Delivery",
  deliveryAddress: "Delivery address",
  itemsTitle: "Ordered items",
  lineItem: "Qty {quantity} • {unitPrice} each",
  subtotal: "Subtotal",
  total: "Total",
  openDashboard: "Open dashboard",
  productImageAlt: "Product image for {name}",
} as const;

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export async function renderNewOrderNotificationEmail(
  payload: NewOrderNotificationEmailPayload,
): Promise<NewOrderNotificationEmailContent> {
  const subject = formatLine(copy.subject, { orderId: payload.orderId });
  const placedAt = dateTimeFormatter.format(payload.placedAt);
  const addressLines = payload.formattedAddress.split("\n").filter(Boolean);
  const items = payload.items.map((item) => ({
    name: item.name,
    initials: getInitials(item.name),
    imageUrl: item.imageUrl,
    imageAlt: formatLine(copy.productImageAlt, { name: item.name }),
    lineItem: formatLine(copy.lineItem, {
      quantity: item.quantity,
      unitPrice: formatCents(item.unitPriceCents),
    }),
    vendor: item.vendorName,
    total: formatCents(item.lineTotalCents),
  }));

  const html = await render(
    <EmailLayout
      subject={subject}
      preview={copy.preview}
      eyebrow={copy.brand}
      title={subject}
      intro={copy.intro}
      action={{ href: payload.dashboardOrderUrl, label: copy.openDashboard }}
    >
      <EmailSection label={copy.orderTitle}>
        <FieldTable
          rows={[
            { label: copy.orderNumber, value: `#${payload.orderId}` },
            { label: copy.placedAt, value: placedAt },
          ]}
        />
      </EmailSection>
      <EmailSection label={copy.customerTitle}>
        <FieldTable
          rows={[
            { label: copy.name, value: payload.customer.name },
            { label: copy.email, value: <MailLink email={payload.customer.email} /> },
            ...(payload.customer.phone
              ? [{ label: copy.phone, value: payload.customer.phone }]
              : []),
          ]}
        />
      </EmailSection>
      <EmailSection label={copy.deliveryTitle}>
        <AddressBlock label={copy.deliveryAddress} lines={addressLines} />
      </EmailSection>
      <EmailSection label={copy.itemsTitle}>
        <ItemRows items={items} />
        <TotalsTable
          rows={[{ label: copy.subtotal, value: formatCents(payload.subtotalCents) }]}
          total={{ label: copy.total, value: formatCents(payload.totalCents) }}
        />
      </EmailSection>
    </EmailLayout>,
  );

  const itemLines = payload.items.flatMap((item) => {
    const lines = [
      `- ${item.name}`,
      `  ${formatLine(copy.lineItem, {
        quantity: item.quantity,
        unitPrice: formatCents(item.unitPriceCents),
      })}`,
      `  ${copy.total}: ${formatCents(item.lineTotalCents)}`,
    ];

    if (item.vendorName) {
      lines.push(`  ${item.vendorName}`);
    }

    return lines;
  });

  const text = [
    subject,
    "",
    copy.intro,
    "",
    `${copy.orderNumber}: #${payload.orderId}`,
    `${copy.placedAt}: ${placedAt}`,
    "",
    copy.customerTitle,
    `${copy.name}: ${payload.customer.name}`,
    `${copy.email}: ${payload.customer.email}`,
    ...(payload.customer.phone ? [`${copy.phone}: ${payload.customer.phone}`] : []),
    "",
    copy.deliveryTitle,
    copy.deliveryAddress,
    ...addressLines,
    "",
    copy.itemsTitle,
    ...itemLines,
    "",
    `${copy.subtotal}: ${formatCents(payload.subtotalCents)}`,
    `${copy.total}: ${formatCents(payload.totalCents)}`,
    "",
    copy.openDashboard,
    payload.dashboardOrderUrl,
  ].join("\n");

  return { subject, html, text };
}
