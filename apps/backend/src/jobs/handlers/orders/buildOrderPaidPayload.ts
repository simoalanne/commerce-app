import type { ShippingAddress } from "@acme/shared/schemas/shippingAddress";

import envConfig from "#src/config.ts";
import { db } from "#src/db/client.ts";
import { ObjectStorage } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { getOnlineStoreUrl } from "#src/utils/getOnlineStoreUrl.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";
import { getLocalizedValue } from "#src/utils/localizedObject.ts";

export type OrderPaidPayload = {
  orderId: number;
  placedAt: string;
  locale: string;
  recipientEmail: string;
  recipientPhone?: string | null;
  recipientName: string;
  recipientFirstName: string;
  shippingAddress: ShippingAddress;
  items: {
    sku: string;
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
  claimToken: string;
  viewOrderUrl: string;
  isGuestOrder: boolean;
};

const buildViewOrderUrl = ({
  baseUrl,
  locale,
  orderId,
  claimToken,
}: {
  baseUrl: string;
  locale: string;
  orderId: number;
  claimToken: string;
}) => {
  const url = new URL(
    `/${locale}/checkout/success/access-token`,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  );
  url.searchParams.set("orderId", String(orderId));
  url.searchParams.set("token", claimToken);
  return url.toString();
};

export const buildOrderPaidPayload = async (orderId: number): Promise<OrderPaidPayload> => {
  const order = await db.query.order.findFirst({
    where: { id: orderId },
    columns: {
      id: true,
      status: true,
      itemsSubtotalCents: true,
      itemsDiscountCents: true,
      chargedTotalCents: true,
      vatRate: true,
      includedVatCents: true,
      claimToken: true,
      customerId: true,
      preferredLocale: true,
      createdAt: true,
      orderDetails: true,
    },
    with: {
      orderItems: {
        orderBy: { id: "asc" },
        with: {
          product: {
            columns: {
              name: true,
            },
            with: { images: FIRST_LINKED_IMAGE_SELECT },
          },
        },
      },
    },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  const orderDetails = order.orderDetails;
  const locale = order.preferredLocale ?? "en";

  const isGuestOrder = order.customerId === null;
  const recipientName = orderDetails.customer.name;
  const recipientPhone = orderDetails.customer.phone ?? null;
  const claimToken = order.claimToken;

  if (!claimToken) {
    throw new Error(`Missing claim token for order ${order.id}`);
  }

  return {
    orderId: order.id,
    placedAt: order.createdAt,
    locale,
    recipientEmail: orderDetails.customer.email,
    recipientPhone,
    recipientName,
    recipientFirstName: recipientName.split(/\s+/)[0] ?? recipientName,
    shippingAddress: orderDetails.shippingAddress,
    items: order.orderItems.map((item) => {
      return {
        sku: item.sku,
        name: (getLocalizedValue(item.product?.name, locale) as string | undefined) ?? item.name,
        vendorName: item.vendorName,
        imageUrl: getFirstLinkedImageUrl(ObjectStorage, item.product?.images),
        quantity: item.quantity,
        unitPriceCents: item.unitSalesPriceCents,
        lineTotalCents: item.unitSalesPriceCents * item.quantity,
      };
    }),
    subtotalCents: order.itemsSubtotalCents - order.itemsDiscountCents,
    totalCents: order.chargedTotalCents,
    vatRate: order.vatRate,
    includedVatCents: order.includedVatCents,
    claimToken,
    viewOrderUrl: buildViewOrderUrl({
      baseUrl: getOnlineStoreUrl(envConfig, "/"),
      locale,
      orderId: order.id,
      claimToken,
    }),
    isGuestOrder,
  };
};
