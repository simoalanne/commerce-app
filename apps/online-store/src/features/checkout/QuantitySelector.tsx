"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "./CheckoutPage.module.css";

type QuantitySelectorProps = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  incrementDisabled?: boolean;
};

export function QuantitySelector({
  value,
  onIncrement,
  onDecrement,
  incrementDisabled = false,
}: QuantitySelectorProps) {
  const t = useTranslations("checkout");

  return (
    <div className={styles.quantityControl}>
      <button
        type="button"
        className={styles.quantityButton}
        onClick={onDecrement}
        aria-label={t("decreaseQuantity")}
      >
        <Minus className={styles.iconSm} strokeWidth={2} />
      </button>
      <span className={styles.quantityValue}>{value}</span>
      <button
        type="button"
        className={styles.quantityButton}
        onClick={onIncrement}
        aria-label={t("increaseQuantity")}
        disabled={incrementDisabled}
      >
        <Plus className={styles.iconSm} strokeWidth={2} />
      </button>
    </div>
  );
}
