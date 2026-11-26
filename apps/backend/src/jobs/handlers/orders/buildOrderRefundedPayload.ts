import { ObjectStorage } from "#src/integrations/object-storage/objectStorage.provider.ts";
import prismaClient from "#src/prisma.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";
import { getLocalizedValue } from "#src/utils/localizedObject.ts";

type OrderDetails = PrismaJson.OrderDetails;

export type OrderRefundedPayload = {
  orderId: number;
  locale: string;
  recipientEmail: string;
  recipientName: string;
  recipientFirstName: string;
  total: number;
  items: {
    sku: string;
    name: string;
    vendorName: string | null;
    imageUrl: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

export const buildOrderRefundedPayload = async (
  refundId: number,
): Promise<OrderRefundedPayload> => {
  const refund = await prismaClient.refund.findUniqueOrThrow({
    where: { id: refundId },
    select: {
      total_amount: true,
      order: {
        select: {
          id: true,
          preferred_locale: true,
          order_details: true,
        },
      },
      refund_items: {
        orderBy: { id: "asc" },
        select: {
          quantity: true,
          amount: true,
          order_item: {
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
      },
    },
  });

  const order = refund.order;
  const orderDetails = order.order_details as OrderDetails;
  const locale = order.preferred_locale ?? "en";
  const recipientName = orderDetails.customer.name;

  const items = refund.refund_items.flatMap((refundItem) => {
    if (refundItem.quantity == null) return [];

    const orderedItem = refundItem.order_item;
    const unitPrice = roundToCents(orderedItem.unit_sales_price.toNumber());

    return {
      sku: orderedItem.sku,
      name:
        (getLocalizedValue(orderedItem.product?.name, locale) as string | undefined) ??
        orderedItem.name ??
        orderedItem.sku,
      vendorName: orderedItem.vendor_name ?? null,
      imageUrl: getFirstLinkedImageUrl(ObjectStorage, orderedItem.product?.images),
      quantity: refundItem.quantity,
      unitPrice,
      lineTotal: roundToCents(refundItem.amount.toNumber()),
    };
  });

  return {
    orderId: order.id,
    locale,
    recipientEmail: orderDetails.customer.email,
    recipientName,
    recipientFirstName: recipientName.split(/\s+/)[0] ?? recipientName,
    items,
    total: refund.total_amount.toNumber(),
  };
};
