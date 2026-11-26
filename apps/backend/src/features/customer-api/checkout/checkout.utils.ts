import type { Prisma, PrismaClient, Product } from "@prisma/client";
import type z from "zod";

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
  deliveryInstructions: PrismaJson.DeliveryInstructions;
};

export type RecipientInput = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
};

type PurchasableProduct = Prisma.ProductGetPayload<{
  include: { vendor: { select: { name: true } } };
}>;

const formatRecipientName = ({ firstName, lastName }: RecipientInput) => `${firstName} ${lastName}`;

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
}): PrismaJson.OrderDetails => ({
  customer: {
    name: formatRecipientName(recipient),
    email: recipient.email.trim().toLowerCase(),
    phone: recipient.phone,
  },
  delivery: {
    addressLabel: formatAddressLabel(deliveryAddress),
    city: deliveryAddress.city,
    instructions: deliveryAddress.deliveryInstructions,
  },
});

export const fetchPurchasableProducts = (db: PrismaClient, skus: string[]) =>
  db.product.findMany({
    where: activeStorefrontProductWhere({ skus }),
    include: { vendor: { select: { name: true } } },
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
    vendorId: p.vendor_id,
    vendorName: p.vendor.name,
    quantity: cart[p.sku].quantity,
    unitPriceCents: p.sales_price_cents,
    unitCostPriceCents: p.cost_price_cents,
    weightGrams: p.weight_grams,
  }));
};

const resolveLocalizedSnapshotName = (value: PrismaJson.LocalizedString, locale: SupportedLocale) =>
  value[locale] ?? value.en ?? Object.values(value)[0] ?? "";

export const validateCartPurchaseLimits = (
  products: Product[],
  cart: z.output<typeof CheckoutCartSchema>,
) => {
  const exceededLimits = products.flatMap((product) => {
    const cartItem = cart[product.sku];
    if (!cartItem || product.purchase_limit_per_order <= 0) {
      return [];
    }

    if (cartItem.quantity <= product.purchase_limit_per_order) {
      return [];
    }

    return [
      {
        sku: product.sku,
        purchaseLimit: product.purchase_limit_per_order,
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

    const currentUnitPriceCents = product.sales_price_cents;
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
