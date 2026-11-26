import createServerSideApiClient from "@/server/serverApiClient";
import type { DestructuredRouteParams } from "@/types";
import type { ProductSummary } from "@/types/api";

import {
  buildCheckoutCartItems,
  type CartItems,
  type CheckoutCartProductItem,
  getProductMaxOrderQuantity,
} from "./cartState";
import type { PaymentOptions } from "./checkoutTypes";
import { readServerCartCookie } from "./readServerCartCookie";

type GetCheckoutServerStateOptions = {
  locale: string;
  params?: DestructuredRouteParams;
  includePaymentMethods?: boolean;
  adjustCartToAvailability?: boolean;
};

export type CheckoutCartAdjustmentNotice = {
  changedItems: Array<{
    sku: string;
    productName: string;
    productImageUrl: string;
    newQuantity: number;
    newUnitPriceCents: number;
    oldQuantity?: number | null;
    oldUnitPriceCents?: number | null;
  }>;
  removedItemCount: number;
};

type CheckoutServerState = {
  locale: string;
  cartUpdatedAt: number | null;
  cart: CartItems;
  cartItems: CheckoutCartProductItem[];
  cartAdjustmentNotice: CheckoutCartAdjustmentNotice | null;
  products: ProductSummary[];
  paymentOptions: PaymentOptions;
};

export async function getCheckoutServerState({
  locale,
  includePaymentMethods = false,
  adjustCartToAvailability = true,
  params,
}: GetCheckoutServerStateOptions): Promise<CheckoutServerState> {
  const cartCookie = await readServerCartCookie();
  const hasCartItems = Object.keys(cartCookie?.items ?? {}).length > 0;
  const client = await createServerSideApiClient(params ?? Promise.resolve({ locale }));

  const [{ body: products }, paymentOptions] = await Promise.all([
    client.products.getAll({}),
    includePaymentMethods
      ? client.checkout.getPaymentMethods().then(({ body }) => body)
      : Promise.resolve({ providers: [], paytrailMethods: [] }),
  ]);

  const productsBySku = new Map(products.map((product) => [product.sku, product]));

  const cartEntries = adjustCartToAvailability
    ? Object.entries(cartCookie?.items ?? {}).reduce((entries, [sku, item]) => {
        const product = productsBySku.get(sku);
        const maxQuantity = product ? getProductMaxOrderQuantity(product) : 0;
        if (!product || maxQuantity === 0) {
          return entries;
        }
        entries[sku] = {
          quantity: Math.min(item.quantity, maxQuantity),
          unitPriceCents: product.priceCents,
        };
        return entries;
      }, {} as CartItems)
    : (cartCookie?.items ?? {});

  const cartItems = buildCheckoutCartItems(products, cartEntries);

  const changedItems = Object.entries(cartEntries).flatMap(([sku, item]) => {
    const previousItem = cartCookie?.items[sku];
    if (!previousItem) {
      return [];
    }

    const quantityChanged = previousItem.quantity !== item.quantity;
    const priceChanged = previousItem.unitPriceCents !== item.unitPriceCents;
    if (!quantityChanged && !priceChanged) {
      return [];
    }

    const product = productsBySku.get(sku);
    if (!product) {
      return [];
    }

    return [
      {
        sku,
        productName: product.name,
        productImageUrl: product.imageUrl,
        newQuantity: item.quantity,
        newUnitPriceCents: item.unitPriceCents,
        oldQuantity: quantityChanged ? previousItem.quantity : null,
        oldUnitPriceCents: priceChanged ? previousItem.unitPriceCents : null,
      },
    ];
  });
  const removedItemCount = Object.keys(cartCookie?.items ?? {}).filter(
    (sku) => !cartEntries[sku],
  ).length;
  const cartAdjustmentNotice =
    hasCartItems && (changedItems.length > 0 || removedItemCount > 0)
      ? {
          changedItems,
          removedItemCount,
        }
      : null;
  return {
    locale,
    cartUpdatedAt: cartCookie?.updatedAt ?? null,
    cart: cartEntries,
    cartItems,
    cartAdjustmentNotice,
    products,
    paymentOptions,
  };
}
