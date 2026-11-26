import type { CheckoutCartProductItem } from "@/features/checkout/cartState";
import { formatCents } from "@/utils/formatPrice";

import { CheckoutCartItemRow } from "./CheckoutCartItemRow";

import styles from "./CheckoutPage.module.css";

type CheckoutCartItemsProps = {
  items: CheckoutCartProductItem[];
};

export function CheckoutCartItems({ items }: CheckoutCartItemsProps) {
  return (
    <section className={styles.itemsList}>
      {items.map((item) => (
        <CheckoutCartItemRow
          key={item.product.sku}
          product={item.product}
          quantity={item.quantity}
          formattedUnitPrice={formatCents(item.product.priceCents)}
          formattedLineTotal={formatCents(item.product.priceCents * item.quantity)}
        />
      ))}
    </section>
  );
}
