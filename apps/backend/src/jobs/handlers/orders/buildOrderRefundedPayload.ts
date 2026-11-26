import { db } from "#src/db/client.ts";
import { ObjectStorage } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";
import { getLocalizedValue } from "#src/utils/localizedObject.ts";

export type OrderRefundedPayload = {
  orderId: number;
  locale: string;
  recipientEmail: string;
  recipientName: string;
  recipientFirstName: string;
  totalCents: number;
  items: {
    sku: string;
    name: string;
    vendorName: string | null;
    imageUrl: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
};

export const buildOrderRefundedPayload = async (
  refundId: number,
): Promise<OrderRefundedPayload> => {
  const refund = await db.query.refund.findFirst({
    where: { id: refundId },
    columns: {
      totalAmountCents: true,
    },
    with: {
      order: {
        columns: {
          id: true,
          preferredLocale: true,
          orderDetails: true,
        },
      },
      refundItems: {
        orderBy: { id: "asc" },
        columns: {
          quantity: true,
          amountCents: true,
        },
        with: {
          orderItem: {
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
      },
    },
  });
  if (!refund) throw new Error(`Refund ${refundId} not found`);

  const order = refund.order;
  const orderDetails = order.orderDetails;
  const locale = order.preferredLocale ?? "en";
  const recipientName = orderDetails.customer.name;

  const items = refund.refundItems.flatMap((refundItem) => {
    if (refundItem.quantity == null) return [];

    const orderedItem = refundItem.orderItem;
    return {
      sku: orderedItem.sku,
      name:
        (getLocalizedValue(orderedItem.product?.name, locale) as string | undefined) ??
        orderedItem.name ??
        orderedItem.sku,
      vendorName: orderedItem.vendorName ?? null,
      imageUrl: getFirstLinkedImageUrl(ObjectStorage, orderedItem.product?.images),
      quantity: refundItem.quantity,
      unitPriceCents: orderedItem.unitSalesPriceCents,
      lineTotalCents: refundItem.amountCents,
    };
  });

  return {
    orderId: order.id,
    locale,
    recipientEmail: orderDetails.customer.email,
    recipientName,
    recipientFirstName: recipientName.split(/\s+/)[0] ?? recipientName,
    items,
    totalCents: refund.totalAmountCents,
  };
};
