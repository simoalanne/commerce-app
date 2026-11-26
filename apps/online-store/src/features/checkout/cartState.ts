import type { ProductSummary } from "@/types/api";

export type CartItem = {
  quantity: number;
  unitPrice: number;
};

export type CartItems = Record<string, CartItem>;
export type CartQuantities = Record<string, number>;

export type CheckoutCartProductItem = {
  product: ProductSummary;
  quantity: number;
};

export function getCartTotalQuantity(items: CartItems) {
  return Object.values(items).reduce((total, item) => total + item.quantity, 0);
}

export function getProductMaxOrderQuantity(product: ProductSummary) {
  if (product.purchaseLimitPerOrder <= 0) {
    return product.availableStock;
  }

  return Math.min(product.availableStock, product.purchaseLimitPerOrder);
}

export function buildCheckoutCartItems(products: ProductSummary[], items: CartItems) {
  const productsBySku = new Map(products.map((product) => [product.sku, product]));

  return Object.entries(items)
    .map(([sku, item]) => {
      const product = productsBySku.get(sku);
      if (!product) {
        return null;
      }

      return {
        product,
        quantity: item.quantity,
      } satisfies CheckoutCartProductItem;
    })
    .filter((item): item is CheckoutCartProductItem => item !== null);
}

export function applyQuantitiesToCheckoutCartItems(
  items: CheckoutCartProductItem[],
  cartItems: CartItems,
) {
  return items
    .map((item) => ({
      ...item,
      quantity: cartItems[item.product.sku]?.quantity ?? 0,
    }))
    .filter((item) => item.quantity > 0);
}

export function getCheckoutCartQuantities(items: CheckoutCartProductItem[]) {
  return Object.fromEntries(
    items.map((item) => [item.product.sku, item.quantity]),
  ) satisfies CartQuantities;
}

export function buildCartItemsFromCheckoutItems(items: CheckoutCartProductItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.product.sku,
      {
        quantity: item.quantity,
        unitPrice: item.product.price,
      } satisfies CartItem,
    ]),
  ) satisfies CartItems;
}

export function getCheckoutSubtotal(items: CheckoutCartProductItem[]) {
  return items.reduce((total, item) => total + item.product.price * item.quantity, 0);
}
