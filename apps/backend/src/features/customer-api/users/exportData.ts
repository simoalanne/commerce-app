import { RouteError } from "@rest-rpc/server";

import type { DeliveryInstructions } from "#src/db/json.ts";
import type { AppContext } from "#src/routing/base.ts";

const getFullName = (firstName: string | null, lastName: string | null) => {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || null;
};

const toNullableInstructions = (instructions: DeliveryInstructions | undefined) => {
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
  const customerAccount = await db.query.customerAccount.findFirst({
    where: {
      id: customerId,
    },
    columns: {},
    with: {
      customerSavedCartItems: {
        columns: {
          product_id: true,
          quantity: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      },
      customerFavoriteProducts: {
        columns: {
          product_id: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      },
      customerFavoriteVendors: {
        columns: {
          vendor_id: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      },
      addresses: {
        columns: {
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
        columns: {
          id: true,
          items_subtotal_cents: true,
          items_discount_cents: true,
          charged_total_cents: true,
          status: true,
          created_at: true,
          order_details: true,
        },
        with: {
          reviews: {
            columns: {
              id: true,
              kind: true,
              rating: true,
              comment: true,
              show_reviewer_name: true,
              product_id: true,
              vendor_id: true,
              created_at: true,
            },
            with: {
              images: {
                columns: {
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
            columns: {
              name: true,
              quantity: true,
              unit_sales_price_cents: true,
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
  if (!customerAccount) throw new RouteError("NOT_FOUND", { status: 404 });

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
        subtotalCents: order.items_subtotal_cents - order.items_discount_cents,
        totalCents: order.charged_total_cents,
        items: order.order_items.map((item) => ({
          productName: item.name,
          vendorName: item.vendor_name,
          quantity: item.quantity,
          unitPriceCents: item.unit_sales_price_cents,
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
