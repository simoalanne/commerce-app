import type { TableCell } from "pdfmake";

import type { EnvConfig } from "#src/config.ts";
import type { Db } from "#src/db/client.ts";
import {
  findRelevantOrderById,
  type RelevantOrder,
} from "#src/features/customer-api/orders/relevantOrders.ts";

import {
  amountExcludingVat,
  buildSellerCustomerSection,
  buildTextLines,
  companyLogo,
  formatDateTime,
  formatMoney,
  headerCell,
  labelledLine,
  type PdfDocumentDefinition,
  pdfMake,
  rightCell,
} from "./financialPdf.shared.ts";

type PdfDependencies = {
  db: Db;
  config: EnvConfig;
};

type GenerateOrderInvoicePdfInput =
  | { access: "customer"; orderId: number; customerId: number; locale?: string }
  | { access: "admin"; orderId: number; locale?: string }
  | { access: "internal"; orderId: number; locale?: string };

const translations = {
  en: {
    title: "Receipt",
    orderNumber: "Order number",
    orderDate: "Order date",
    seller: "Seller",
    customer: "Customer",
    businessId: "Business ID",
    vatId: "VAT ID",
    paymentProvider: "Provider",
    paymentId: "Payment ID",
    productName: "Name",
    quantity: "Qty",
    unitExclVat: "Unit excl. VAT",
    vatRate: "VAT %",
    lineExclVat: "Line excl. VAT",
    lineInclVat: "Line incl. VAT",
    itemsSubtotal: "Items subtotal",
    itemsDiscount: "Items discount",
    total: "Total",
    includedVat: "Included VAT",
    taxableAmount: "Taxable amount excl. VAT",
  },
} as const;

const getTranslation = (locale: string) =>
  translations[locale as keyof typeof translations] ?? translations.en;

type InvoiceTotalRow = readonly [label: string, taxableAmount: number, totalAmount: number];

const renderOrderInvoicePdf = async (config: EnvConfig, order: RelevantOrder, locale: string) => {
  if (!order.paymentId) {
    throw new Error(`Cannot generate receipt for order ${order.id} without payment_id`);
  }
  if (!order.paidAt) {
    throw new Error(`Cannot generate receipt for order ${order.id} without paid_at`);
  }

  const t = getTranslation(locale);
  const vatRate = order.vatRate;
  const taxableAmount = order.chargedTotalCents - order.includedVatCents;
  const lineRows = order.orderItems.map((item) => {
    const unitPrice = item.unitSalesPriceCents;
    const lineInclVat = unitPrice * item.quantity;
    const unitExclVat = amountExcludingVat(unitPrice, vatRate);
    const lineExclVat = amountExcludingVat(lineInclVat, vatRate);

    return {
      productName: item.name,
      quantity: String(item.quantity),
      unitExclVat,
      vatRate,
      lineExclVat,
      lineInclVat,
    };
  });
  const itemRows: TableCell[][] = lineRows.map((row) => [
    { text: row.productName, bold: true },
    rightCell(row.quantity),
    rightCell(formatMoney(row.unitExclVat)),
    rightCell(`${row.vatRate}%`),
    rightCell(formatMoney(row.lineExclVat)),
    rightCell(formatMoney(row.lineInclVat)),
  ]);
  const totalRows = [
    [
      t.itemsSubtotal,
      amountExcludingVat(order.itemsSubtotalCents, vatRate),
      order.itemsSubtotalCents,
    ],
    [
      t.itemsDiscount,
      amountExcludingVat(-order.itemsDiscountCents, vatRate),
      -order.itemsDiscountCents,
    ],
  ] as const satisfies readonly InvoiceTotalRow[];

  const docDefinition: PdfDocumentDefinition = {
    info: {
      title: `${t.title} ${order.id}`,
      subject: `Order ${order.id}`,
    },
    pageMargins: [36, 38, 36, 42],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      lineHeight: 1.2,
    },
    content: [
      {
        columns: [
          {
            text: `${t.title} ${order.id}`,
            style: "title",
            width: "*",
          },
          companyLogo,
        ],
        margin: [0, 0, 0, 16],
      },
      {
        columns: [
          {
            width: "*",
            stack: buildTextLines([
              labelledLine(t.orderNumber, String(order.id)),
              labelledLine(t.orderDate, formatDateTime(order.paidAt)),
            ]),
          },
          {
            width: "*",
            stack: buildTextLines([
              labelledLine(t.paymentProvider, order.paymentProvider),
              labelledLine(t.paymentId, order.paymentId),
            ]),
          },
        ],
        columnGap: 30,
        margin: [0, 0, 0, 18],
      },
      buildSellerCustomerSection({
        config,
        order,
        labels: {
          seller: t.seller,
          customer: t.customer,
          businessId: t.businessId,
          vatId: t.vatId,
        },
      }),
      {
        table: {
          headerRows: 1,
          widths: ["*", 32, 70, 42, 70, 70],
          body: [
            [
              headerCell(t.productName),
              headerCell(t.quantity, "right"),
              headerCell(t.unitExclVat, "right"),
              headerCell(t.vatRate, "right"),
              headerCell(t.lineExclVat, "right"),
              headerCell(t.lineInclVat, "right"),
            ],
            ...itemRows,
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 18],
      },
      {
        table: {
          widths: ["*", 92, 92],
          body: [
            ["", headerCell(t.taxableAmount, "right"), headerCell(t.total, "right")],
            ...totalRows.map(([label, taxable, total]) => [
              label,
              rightCell(formatMoney(taxable)),
              rightCell(formatMoney(total)),
            ]),
            [
              { text: t.total, bold: true },
              {
                text: formatMoney(taxableAmount),
                alignment: "right",
                bold: true,
              },
              {
                text: formatMoney(order.chargedTotalCents),
                alignment: "right",
                bold: true,
              },
            ],
            ["", t.includedVat, rightCell(formatMoney(order.includedVatCents))],
          ],
        },
        layout: "lightHorizontalLines",
      },
    ],
    styles: {
      title: {
        fontSize: 22,
        bold: true,
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 6],
      },
      tableHeader: {
        bold: true,
        fillColor: "#eeeeee",
      },
    },
  };

  const body = await pdfMake.createPdf(docDefinition).getBuffer();

  return {
    body,
    contentType: "application/pdf",
    filename: `${t.title.toLowerCase()}-${order.id}.pdf`,
  };
};

export const generateOrderInvoicePdf = async (
  { db, config }: PdfDependencies,
  input: GenerateOrderInvoicePdfInput,
) => {
  const order = await findRelevantOrderById(db, {
    orderId: input.orderId,
    ...(input.access === "customer" ? { customerId: input.customerId } : {}),
  });

  return renderOrderInvoicePdf(config, order, input.locale ?? order.preferredLocale);
};
