import { formatShippingAddressLines } from "@acme/shared/schemas/shippingAddress";
import type { Content, TableCell } from "pdfmake";
import pdfMake from "pdfmake";
// @ts-expect-error no types available, no point declaring for this usage
import robotoFonts from "pdfmake/fonts/Roboto.js";

import type { EnvConfig } from "#src/config.ts";
import { getCompanyContactInformation } from "#src/domain/getCompanyDetails.ts";
import type { RelevantOrder } from "#src/features/customer-api/orders/relevantOrders.ts";

pdfMake.addFonts(robotoFonts);

export { pdfMake };

export type PdfDocumentDefinition = Parameters<typeof pdfMake.createPdf>[0];

// A text wordmark until the project has a logo.
export const companyLogo: Content = {
  text: "Acme",
  bold: true,
  fontSize: 20,
  alignment: "right",
};

// Amounts are integer cents.
export const amountExcludingVat = (amountIncludingVatCents: number, vatRate: number) =>
  Math.round((amountIncludingVatCents * 100) / (100 + vatRate));

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));

export const rightCell = (text: string): TableCell => ({
  text,
  alignment: "right",
});

export const headerCell = (text: string, alignment?: "right"): TableCell => ({
  text,
  style: "tableHeader",
  ...(alignment ? { alignment } : {}),
});

export const labelledLine = (label: string, value: string | null | undefined) =>
  value ? `${label}: ${value}` : undefined;

export const buildTextLines = (rows: Array<string | null | undefined>): Content[] =>
  rows
    .filter((row): row is string => Boolean(row))
    .map((text) => ({
      text,
      margin: [0, 0, 0, 2] as [number, number, number, number],
    }));

export const buildSellerCustomerSection = ({
  config,
  order,
  labels,
}: {
  config: EnvConfig;
  order: RelevantOrder;
  labels: {
    seller: string;
    customer: string;
    businessId: string;
    vatId: string;
  };
}): Content => {
  const seller = order.invoiceDetails.seller;
  const contact = getCompanyContactInformation(config);
  const vatId = `FI${seller.businessId.replaceAll("-", "")}`;

  return {
    columns: [
      {
        width: "*",
        stack: [
          { text: labels.seller, style: "sectionTitle" },
          ...buildTextLines([
            seller.name,
            labelledLine(labels.businessId, seller.businessId),
            labelledLine(labels.vatId, vatId),
            seller.address,
            contact.email,
            contact.phone,
          ]),
        ],
      },
      {
        width: "*",
        stack: [
          { text: labels.customer, style: "sectionTitle" },
          ...buildTextLines([
            order.orderDetails.customer.name,
            order.orderDetails.customer.email,
            order.orderDetails.customer.phone,
            ...formatShippingAddressLines(order.orderDetails.shippingAddress),
          ]),
        ],
      },
    ],
    columnGap: 30,
    margin: [0, 0, 0, 18],
  };
};
