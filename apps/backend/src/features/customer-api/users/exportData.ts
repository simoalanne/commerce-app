import type { AppContext } from "#src/routing/base.ts";

const getFullName = (firstName: string | null, lastName: string | null) => {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || null;
};

const toNullableInstructions = (instructions: PrismaJson.DeliveryInstructions | undefined) => {
  if (!instructions) {
    return null;
  }

  const normalized = {
    freeForm: instructions.freeForm ?? null,
    apartmentEntrance: instructions.apartmentEntrance ?? null,
    doorCode: instructions.doorCode ?? null,
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
};

const statusLabels: Record<string, string> = {
  PENDING: "pending",
  PAID: "paid",
  EXPIRED: "expired",
  AWAITING_REFUND: "awaiting refund",
  REFUNDED: "refunded",
  DELIVERED: "delivered",
};

export const buildCustomerDataExport = async (
  { db, storage }: Pick<AppContext, "db" | "storage">,
  customerId: number,
  identity: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  },
) => {
  const customerAccount = await db.customerAccount.findUniqueOrThrow({
    where: {
      id: customerId,
    },
    select: {
      customerSavedCartItems: {
        select: {
          product_id: true,
          quantity: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      },
      customerFavoriteProducts: {
        select: {
          product_id: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      },
      customerFavoriteVendors: {
        select: {
          vendor_id: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      },
      addresses: {
        select: {
          street: true,
          street_number: true,
          postal_code: true,
          city: true,
          delivery_details: true,
        },
        orderBy: {
          id: "desc",
        },
      },
      orders: {
        select: {
          id: true,
          items_subtotal: true,
          items_discount_amount: true,
          delivery_fee: true,
          delivery_discount_amount: true,
          tip_amount: true,
          charged_total: true,
          status: true,
          created_at: true,
          order_details: true,
          reviews: {
            select: {
              id: true,
              kind: true,
              rating: true,
              comment: true,
              show_reviewer_name: true,
              product_id: true,
              vendor_id: true,
              created_at: true,
              images: {
                select: {
                  storage_key: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          },
          order_items: {
            orderBy: {
              id: "asc",
            },
            select: {
              name: true,
              quantity: true,
              unit_sales_price: true,
              vendor_name: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      },
    },
  });

  const { firstName, lastName, email } = identity;

  const exportPayload = {
    email,
    name: getFullName(firstName, lastName),
    firstName,
    lastName,
    savedCart: customerAccount.customerSavedCartItems.map((item) => ({
      productId: item.product_id,
      quantity: item.quantity,
      addedAt: item.added_at,
    })),
    favoriteProducts: customerAccount.customerFavoriteProducts.map((item) => ({
      id: item.product_id,
      addedAt: item.added_at,
    })),
    favoriteVendors: customerAccount.customerFavoriteVendors.map((item) => ({
      id: item.vendor_id,
      addedAt: item.added_at,
    })),
    addresses: customerAccount.addresses.map((address) => {
      return {
        streetAddress: [address.street, address.street_number].filter(Boolean).join(" "),
        streetNumber: address.street_number,
        postalCode: address.postal_code,
        city: address.city,
        addressType: address.delivery_details.addressType ?? null,
        entrance: address.delivery_details.entrance ?? null,
        floor: address.delivery_details.floor ?? null,
        apartment: address.delivery_details.apartment ?? null,
        deliveryInstructions: toNullableInstructions(address.delivery_details.deliveryInstructions),
      };
    }),
    orders: customerAccount.orders.map((order) => {
      const details = order.order_details;
      return {
        orderNumber: order.id,
        status: statusLabels[order.status] ?? order.status.toLowerCase(),
        createdAt: order.created_at,
        recipient: {
          name: details.customer.name,
          email: details.customer.email,
          phone: details.customer.phone,
        },
        deliveryAddress: details.delivery.addressLabel,
        city: details.delivery.city,
        deliveryInstructions: toNullableInstructions(details.delivery.instructions ?? undefined),
        subtotal: order.items_subtotal.minus(order.items_discount_amount),
        deliveryFee: order.delivery_fee.minus(order.delivery_discount_amount),
        tipAmount: order.tip_amount,
        total: order.charged_total,
        items: order.order_items.map((item) => ({
          productName: item.name,
          vendorName: item.vendor_name,
          quantity: item.quantity,
          unitPrice: item.unit_sales_price,
        })),
        reviews: order.reviews.map((review) => ({
          kind: review.kind,
          rating: review.rating,
          comment: review.comment ?? null,
          showReviewerName: review.show_reviewer_name,
          createdAt: review.created_at,
          imageUrl: review.images?.[0]?.storage_key
            ? storage.getPublicUrl(review.images[0].storage_key)
            : null,
        })),
      };
    }),
    reviews: customerAccount.orders.flatMap((order) =>
      order.reviews.map((review) => ({
        orderNumber: order.id,
        kind: review.kind,
        rating: review.rating,
        comment: review.comment ?? null,
        showReviewerName: review.show_reviewer_name,
        createdAt: review.created_at,
        imageUrl: review.images?.[0]?.storage_key
          ? storage.getPublicUrl(review.images[0].storage_key)
          : null,
      })),
    ),
  };

  return exportPayload;
};
