import { RouteError } from "@rest-rpc/server";
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

type GenerateRefundReceiptPdfInput =
  | {
      access: "customer";
      orderId: number;
      refundId: number;
      customerId: number;
      locale?: string;
    }
  | { access: "admin"; orderId: number; refundId: number; locale?: string }
  | { access: "internal"; refundId: number; locale?: string };

const findRefundForReceipt = (db: Db, refundId: number, orderId: number) =>
  db.query.refund.findFirst({
    where: {
      id: refundId,
      orderId,
      status: "SUCCEEDED",
    },
    columns: {
      id: true,
      orderId: true,
      providerRefundId: true,
      totalAmountCents: true,
      reason: true,
      createdAt: true,
    },
    with: {
      refundItems: {
        orderBy: { id: "asc" },
        columns: {
          quantity: true,
          amountCents: true,
        },
        with: {
          orderItem: {
            columns: {
              name: true,
            },
          },
        },
      },
    },
  });

type RefundReceiptRefund = NonNullable<Awaited<ReturnType<typeof findRefundForReceipt>>>;

const translations = {
  en: {
    title: "Refund receipt",
    receiptNumber: "Receipt number",
    receiptDate: "Refund date",
    originalOrderNumber: "Original order number",
    refundProviderId: "Refund ID",
    seller: "Seller",
    customer: "Customer",
    businessId: "Business ID",
    vatId: "VAT ID",
    paymentProvider: "Provider",
    paymentId: "Payment ID",
    description: "Description",
    quantity: "Qty",
    vatRate: "VAT %",
    refundedAmount: "Refunded amount",
    includedVat: "Included VAT",
    totalRefunded: "Total refunded",
    reason: "Reason",
  },
} as const;

const getTranslation = (locale: string) =>
  translations[locale as keyof typeof translations] ?? translations.en;

const getFilenamePrefix = (title: string) => title.toLowerCase().replaceAll(" ", "-");

type RefundReceiptLineRow = {
  description: string;
  quantity: string;
  vatRate: number;
  amount: number;
  includedVat: number;
};

const includedVatFor = (amountIncludingVat: number, vatRate: number) =>
  vatRate === 0 ? 0 : amountIncludingVat - amountExcludingVat(amountIncludingVat, vatRate);

const renderRefundReceiptPdf = async ({
  config,
  order,
  refund,
  locale,
}: {
  config: EnvConfig;
  order: RelevantOrder;
  refund: RefundReceiptRefund;
  locale: string;
}) => {
  const t = getTranslation(locale);
  const vatRate = order.vatRate;
  const receiptNumber = `RR-${refund.id}`;
  const lineRows: RefundReceiptLineRow[] = refund.refundItems.map((refundItem) => {
    const amount = refundItem.amountCents;

    return {
      description: refundItem.orderItem.name,
      quantity: String(-(refundItem.quantity ?? 0)),
      vatRate,
      amount,
      includedVat: includedVatFor(amount, vatRate),
    };
  });
  const totalAmount = refund.totalAmountCents;
  const includedVatAmount = lineRows.reduce((total, row) => total + row.includedVat, 0);
  const tableRows: TableCell[][] = lineRows.map((row) => [
    { text: row.description, bold: true },
    rightCell(row.quantity),
    rightCell(`${row.vatRate}%`),
    rightCell(formatMoney(row.amount)),
    rightCell(formatMoney(row.includedVat)),
  ]);

  const docDefinition: PdfDocumentDefinition = {
    info: {
      title: `${t.title} ${receiptNumber}`,
      subject: `Refund ${refund.id} for order ${order.id}`,
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
            text: `${t.title} ${receiptNumber}`,
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
              labelledLine(t.receiptNumber, receiptNumber),
              labelledLine(t.receiptDate, formatDateTime(refund.createdAt)),
              labelledLine(t.originalOrderNumber, String(order.id)),
            ]),
          },
          {
            width: "*",
            stack: buildTextLines([
              labelledLine(t.paymentProvider, order.paymentProvider),
              labelledLine(t.paymentId, order.paymentId),
              labelledLine(t.refundProviderId, refund.providerRefundId),
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
          widths: ["*", 38, 42, 88, 78],
          body: [
            [
              headerCell(t.description),
              headerCell(t.quantity, "right"),
              headerCell(t.vatRate, "right"),
              headerCell(t.refundedAmount, "right"),
              headerCell(t.includedVat, "right"),
            ],
            ...tableRows,
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 18],
      },
      {
        stack: [{ text: t.reason, style: "sectionTitle" }, { text: refund.reason ?? "" }],
        margin: [0, 0, 0, 18],
      },
      {
        table: {
          widths: ["*", 110],
          body: [
            [
              { text: t.totalRefunded, bold: true },
              {
                text: formatMoney(totalAmount),
                alignment: "right",
                bold: true,
              },
            ],
            [t.includedVat, rightCell(formatMoney(includedVatAmount))],
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
    filename: `${getFilenamePrefix(t.title)}-${receiptNumber}.pdf`,
  };
};

export const generateRefundReceiptPdf = async (
  { db, config }: PdfDependencies,
  input: GenerateRefundReceiptPdfInput,
) => {
  const refundForOrder =
    input.access === "internal"
      ? await db.query.refund.findFirst({
          where: {
            id: input.refundId,
            status: "SUCCEEDED",
          },
          columns: {
            orderId: true,
          },
        })
      : { orderId: input.orderId };
  if (!refundForOrder) throw new RouteError("NOT_FOUND", { status: 404 });
  const order = await findRelevantOrderById(db, {
    orderId: refundForOrder.orderId,
    ...(input.access === "customer" ? { customerId: input.customerId } : {}),
  });
  const refund = await findRefundForReceipt(db, input.refundId, order.id);
  if (!refund) throw new RouteError("NOT_FOUND", { status: 404 });

  return renderRefundReceiptPdf({
    config,
    order,
    refund,
    locale: input.locale ?? order.preferredLocale,
  });
};
