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
          productId: true,
          quantity: true,
          addedAt: true,
        },
        orderBy: {
          addedAt: "desc",
        },
      },
      customerFavoriteProducts: {
        columns: {
          productId: true,
          addedAt: true,
        },
        orderBy: {
          addedAt: "desc",
        },
      },
      customerFavoriteVendors: {
        columns: {
          vendorId: true,
          addedAt: true,
        },
        orderBy: {
          addedAt: "desc",
        },
      },
      addresses: {
        columns: {
          street: true,
          streetNumber: true,
          postalCode: true,
          city: true,
          deliveryDetails: true,
        },
        orderBy: {
          id: "desc",
        },
      },
      orders: {
        columns: {
          id: true,
          itemsSubtotalCents: true,
          itemsDiscountCents: true,
          chargedTotalCents: true,
          status: true,
          createdAt: true,
          orderDetails: true,
        },
        with: {
          reviews: {
            columns: {
              id: true,
              kind: true,
              rating: true,
              comment: true,
              showReviewerName: true,
              productId: true,
              vendorId: true,
              createdAt: true,
            },
            with: {
              images: {
                columns: {
                  storageKey: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          },
          orderItems: {
            orderBy: {
              id: "asc",
            },
            columns: {
              name: true,
              quantity: true,
              unitSalesPriceCents: true,
              vendorName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
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
      productId: item.productId,
      quantity: item.quantity,
      addedAt: item.addedAt,
    })),
    favoriteProducts: customerAccount.customerFavoriteProducts.map((item) => ({
      id: item.productId,
      addedAt: item.addedAt,
    })),
    favoriteVendors: customerAccount.customerFavoriteVendors.map((item) => ({
      id: item.vendorId,
      addedAt: item.addedAt,
    })),
    addresses: customerAccount.addresses.map((address) => {
      return {
        streetAddress: [address.street, address.streetNumber].filter(Boolean).join(" "),
        streetNumber: address.streetNumber,
        postalCode: address.postalCode,
        city: address.city,
        addressType: address.deliveryDetails.addressType ?? null,
        entrance: address.deliveryDetails.entrance ?? null,
        floor: address.deliveryDetails.floor ?? null,
        apartment: address.deliveryDetails.apartment ?? null,
        deliveryInstructions: toNullableInstructions(address.deliveryDetails.deliveryInstructions),
      };
    }),
    orders: customerAccount.orders.map((order) => {
      const details = order.orderDetails;
      return {
        orderNumber: order.id,
        status: order.status,
        createdAt: order.createdAt,
        recipient: {
          name: details.customer.name,
          email: details.customer.email,
          phone: details.customer.phone,
        },
        deliveryAddress: details.delivery.addressLabel,
        city: details.delivery.city,
        deliveryInstructions: toNullableInstructions(details.delivery.instructions ?? undefined),
        subtotalCents: order.itemsSubtotalCents - order.itemsDiscountCents,
        totalCents: order.chargedTotalCents,
        items: order.orderItems.map((item) => ({
          productName: item.name,
          vendorName: item.vendorName,
          quantity: item.quantity,
          unitPriceCents: item.unitSalesPriceCents,
        })),
        reviews: order.reviews.map((review) => ({
          kind: review.kind,
          rating: review.rating,
          comment: review.comment ?? null,
          showReviewerName: review.showReviewerName,
          createdAt: review.createdAt,
          imageUrl: review.images?.[0]?.storageKey
            ? storage.getPublicUrl(review.images[0].storageKey)
            : null,
        })),
      };
    }),
  };

  return exportPayload;
};
