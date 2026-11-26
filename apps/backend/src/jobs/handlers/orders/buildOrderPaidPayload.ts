import envConfig from "#src/config.ts";
import { ObjectStorage } from "#src/integrations/object-storage/objectStorage.provider.ts";
import prismaClient from "#src/prisma.ts";
import { getOnlineStoreUrl } from "#src/utils/getOnlineStoreUrl.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";
import { getLocalizedValue } from "#src/utils/localizedObject.ts";

export type OrderPaidPayload = {
  orderId: number;
  placedAt: Date;
  locale: string;
  recipientEmail: string;
  recipientPhone?: string | null;
  recipientName: string;
  recipientFirstName: string;
  formattedAddress: string;
  items: {
    sku: string;
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
  claimToken: string;
  viewOrderUrl: string;
  isGuestOrder: boolean;
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

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
  const order = await prismaClient.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      items_subtotal: true,
      items_discount_amount: true,
      delivery_fee: true,
      delivery_discount_amount: true,
      tip_amount: true,
      charged_total: true,
      vat_rate: true,
      included_vat_amount: true,
      claim_token: true,
      customer_id: true,
      preferred_locale: true,
      created_at: true,
      order_details: true,
      order_items: {
        orderBy: { id: "asc" },
        include: {
          product: {
            select: {
              name: true,
              images: FIRST_LINKED_IMAGE_SELECT,
            },
          },
        },
      },
    },
  });

  const orderDetails = order.order_details;
  const locale = order.preferred_locale ?? "en";

  const subtotal = order.items_subtotal.minus(order.items_discount_amount).toNumber();
  const deliveryFee = order.delivery_fee.minus(order.delivery_discount_amount).toNumber();
  const tipAmount = order.tip_amount.toNumber();
  const total = order.charged_total.toNumber();
  const vatRate = order.vat_rate.toNumber();
  const includedVatAmount = order.included_vat_amount.toNumber();
  const isGuestOrder = order.customer_id === null;
  const recipientName = orderDetails.customer.name;
  const recipientPhone = orderDetails.customer.phone ?? null;
  const claimToken = order.claim_token;

  if (!claimToken) {
    throw new Error(`Missing claim token for order ${order.id}`);
  }

  return {
    orderId: order.id,
    placedAt: order.created_at,
    locale,
    recipientEmail: orderDetails.customer.email,
    recipientPhone,
    recipientName,
    recipientFirstName: recipientName.split(/\s+/)[0] ?? recipientName,
    formattedAddress: orderDetails.delivery.addressLabel.replaceAll(", ", "\n"),
    items: order.order_items.map((item) => {
      const unitPrice = roundToCents(item.unit_sales_price.toNumber());
      const lineTotal = roundToCents(unitPrice * item.quantity);

      return {
        sku: item.sku,
        name: (getLocalizedValue(item.product?.name, locale) as string | undefined) ?? item.name,
        vendorName: item.vendor_name,
        imageUrl: getFirstLinkedImageUrl(ObjectStorage, item.product?.images),
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      };
    }),
    subtotal: roundToCents(subtotal),
    deliveryFee: roundToCents(deliveryFee),
    tipAmount: roundToCents(tipAmount),
    total,
    vatRate,
    includedVatAmount: roundToCents(includedVatAmount),
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
