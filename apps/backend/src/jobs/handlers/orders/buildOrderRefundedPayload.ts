import { db } from "#src/db/client.ts";
import { orNotFound } from "#src/db/errors.ts";
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
  const refund = orNotFound(
    await db.query.refund.findFirst({
      where: { id: refundId },
      columns: {
        total_amount_cents: true,
      },
      with: {
        order: {
          columns: {
            id: true,
            preferred_locale: true,
            order_details: true,
          },
        },
        refund_items: {
          orderBy: { id: "asc" },
          columns: {
            quantity: true,
            amount_cents: true,
          },
          with: {
            order_item: {
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
    }),
  );

  const order = refund.order;
  const orderDetails = order.order_details;
  const locale = order.preferred_locale ?? "en";
  const recipientName = orderDetails.customer.name;

  const items = refund.refund_items.flatMap((refundItem) => {
    if (refundItem.quantity == null) return [];

    const orderedItem = refundItem.order_item;
    return {
      sku: orderedItem.sku,
      name:
        (getLocalizedValue(orderedItem.product?.name, locale) as string | undefined) ??
        orderedItem.name ??
        orderedItem.sku,
      vendorName: orderedItem.vendor_name ?? null,
      imageUrl: getFirstLinkedImageUrl(ObjectStorage, orderedItem.product?.images),
      quantity: refundItem.quantity,
      unitPriceCents: orderedItem.unit_sales_price_cents,
      lineTotalCents: refundItem.amount_cents,
    };
  });

  return {
    orderId: order.id,
    locale,
    recipientEmail: orderDetails.customer.email,
    recipientName,
    recipientFirstName: recipientName.split(/\s+/)[0] ?? recipientName,
    items,
    totalCents: refund.total_amount_cents,
  };
};
