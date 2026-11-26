import { renderMjmlTemplate } from "#src/integrations/email/renderMjmlTemplate.ts";

import { formatCurrency, formatLine, getInitials } from "./emailHelpers.ts";

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
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  total: number;
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
      unitPrice: formatCurrency(item.unitPrice),
    }),
    vendor: item.vendorName,
    total: formatCurrency(item.lineTotal),
  }));

  const html = await renderMjmlTemplate("new-order-notification.mjml", {
    subject,
    preview: copy.preview,
    intro: copy.intro,
    brand: {
      name: copy.brand,
    },
    dashboardOrderUrl: payload.dashboardOrderUrl,
    dashboardLabel: copy.openDashboard,
    order: {
      title: copy.orderTitle,
      numberLabel: copy.orderNumber,
      number: payload.orderId,
      placedAtLabel: copy.placedAt,
      placedAt,
    },
    customer: {
      title: copy.customerTitle,
      nameLabel: copy.name,
      name: payload.customer.name,
      emailLabel: copy.email,
      email: payload.customer.email,
      phoneLabel: copy.phone,
      phone: payload.customer.phone,
    },
    delivery: {
      title: copy.deliveryTitle,
      addressLabel: copy.deliveryAddress,
      addressLines,
    },
    itemsTitle: copy.itemsTitle,
    items,
    totals: {
      subtotalLabel: copy.subtotal,
      subtotal: formatCurrency(payload.subtotal),
      totalLabel: copy.total,
      total: formatCurrency(payload.total),
    },
  });

  const itemLines = payload.items.flatMap((item) => {
    const lines = [
      `- ${item.name}`,
      `  ${formatLine(copy.lineItem, {
        quantity: item.quantity,
        unitPrice: formatCurrency(item.unitPrice),
      })}`,
      `  ${copy.total}: ${formatCurrency(item.lineTotal)}`,
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
    `${copy.subtotal}: ${formatCurrency(payload.subtotal)}`,
    `${copy.total}: ${formatCurrency(payload.total)}`,
    "",
    copy.openDashboard,
    payload.dashboardOrderUrl,
  ].join("\n");

  return { subject, html, text };
}
