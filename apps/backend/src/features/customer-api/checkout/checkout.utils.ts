import type z from "zod";

import type { Db } from "#src/db/client.ts";
import type { DeliveryInstructions, LocalizedString, OrderDetails } from "#src/db/json.ts";
import type { productTable } from "#src/db/schema.ts";
import { activeStorefrontProductWhere } from "#src/domain/storefrontVisibility.ts";
import type { SupportedLocale } from "#src/locales.ts";

import { PriceMismatch, ProductsNotPurchasable, PurchaseLimitExceeded } from "./checkout.errors.ts";
import type { CheckoutCartSchema } from "./checkout.routes.ts";

export type DeliveryAddressInput = {
  street: string;
  city: string;
  postalCode: string;
  streetNumber: string | null;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  deliveryInstructions: DeliveryInstructions;
};

export type RecipientInput = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
};

type Product = typeof productTable.$inferSelect;

type PurchasableProduct = Awaited<ReturnType<typeof fetchPurchasableProducts>>[number];

const formatAddressLabel = (address: DeliveryAddressInput) => {
  const streetLine = [address.street, address.streetNumber].filter(Boolean).join(" ").trim();
  const detailLine = [
    address.entrance ? `Entrance ${address.entrance}` : "",
    address.floor ? `Floor ${address.floor}` : "",
    address.apartment ? `Apartment ${address.apartment}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ");

  return [streetLine, detailLine, cityLine].filter(Boolean).join(", ");
};

export const buildOrderDetails = ({
  deliveryAddress,
  recipient,
}: {
  deliveryAddress: DeliveryAddressInput;
  recipient: RecipientInput;
}): OrderDetails => ({
  customer: {
    name: `${recipient.firstName} ${recipient.lastName}`,
    email: recipient.email.trim().toLowerCase(),
    phone: recipient.phone,
  },
  delivery: {
    addressLabel: formatAddressLabel(deliveryAddress),
    city: deliveryAddress.city,
    instructions: deliveryAddress.deliveryInstructions,
  },
});

export const fetchPurchasableProducts = (db: Db, skus: string[]) =>
  db.query.product.findMany({
    where: activeStorefrontProductWhere({ skus }),
    with: { vendor: { columns: { name: true } } },
  });

export const buildOrderItemsFromProducts = (
  products: PurchasableProduct[],
  cart: z.output<typeof CheckoutCartSchema>,
  locale: SupportedLocale = "en",
) => {
  const validSkus = new Set(products.map((p) => p.sku));
  const invalidSkus = Object.keys(cart).filter((sku) => !validSkus.has(sku));

  if (invalidSkus.length) {
    throw new ProductsNotPurchasable({ data: { skus: invalidSkus } });
  }
  return products.map((p) => ({
    sku: p.sku,
    productId: p.id,
    productName: resolveLocalizedSnapshotName(p.name, locale),
    vendorId: p.vendorId,
    vendorName: p.vendor.name,
    quantity: cart[p.sku].quantity,
    unitPriceCents: p.salesPriceCents,
    unitCostPriceCents: p.costPriceCents,
    weightGrams: p.weightGrams,
  }));
};

const resolveLocalizedSnapshotName = (value: LocalizedString, locale: SupportedLocale) =>
  value[locale] ?? value.en ?? Object.values(value)[0] ?? "";

export const validateCartPurchaseLimits = (
  products: Product[],
  cart: z.output<typeof CheckoutCartSchema>,
) => {
  const exceededLimits = products.flatMap((product) => {
    const cartItem = cart[product.sku];
    if (!cartItem || product.purchaseLimitPerOrder <= 0) {
      return [];
    }

    if (cartItem.quantity <= product.purchaseLimitPerOrder) {
      return [];
    }

    return [
      {
        sku: product.sku,
        purchaseLimit: product.purchaseLimitPerOrder,
      },
    ];
  });

  if (exceededLimits.length > 0) {
    throw new PurchaseLimitExceeded({ data: exceededLimits });
  }
};

export const validateCartUnitPrices = (
  products: Product[],
  cart: z.output<typeof CheckoutCartSchema>,
) => {
  const changedPrices = products.flatMap((product) => {
    const cartItem = cart[product.sku];
    if (!cartItem) {
      return [];
    }

    const currentUnitPriceCents = product.salesPriceCents;
    if (cartItem.unitPriceCents === currentUnitPriceCents) {
      return [];
    }

    return [
      {
        sku: product.sku,
        newUnitPriceCents: currentUnitPriceCents,
      },
    ];
  });

  if (changedPrices.length > 0) {
    throw new PriceMismatch({ data: changedPrices });
  }
};

export const calculateOrderTotal = (orderItems: { unitPriceCents: number; quantity: number }[]) =>
  orderItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
