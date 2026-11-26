"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCart } from "@/hooks/useCart";
import type { ProductSummary } from "@/types/api";

import { getProductMaxOrderQuantity } from "./cartState";
import { QuantitySelector } from "./QuantitySelector";

import styles from "./CheckoutPage.module.css";

type CheckoutCartItemControlsProps = {
  product: ProductSummary;
  quantity: number;
};

export function CheckoutCartItemControls({ product, quantity }: CheckoutCartItemControlsProps) {
  const t = useTranslations("checkout");
  const { addProduct, removeProduct, removeAllOfProduct } = useCart();
  const incrementDisabled = quantity >= getProductMaxOrderQuantity(product);

  const handleIncrement = () => {
    if (incrementDisabled) {
      return;
    }

    addProduct(product);
  };

  const handleDecrement = () => {
    removeProduct(product.sku);
  };

  const handleRemove = () => {
    removeAllOfProduct(product.sku);
  };

  return (
    <>
      <QuantitySelector
        value={quantity}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        incrementDisabled={incrementDisabled}
      />
      <button type="button" className={styles.textAction} onClick={handleRemove}>
        <Trash2 className={styles.iconSm} strokeWidth={2} />
        {t("remove")}
      </button>
    </>
  );
}
