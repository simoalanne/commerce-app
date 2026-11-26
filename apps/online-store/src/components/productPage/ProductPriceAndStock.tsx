"use client";

import { useTranslations } from "next-intl";

import { formatCents } from "@/utils/formatPrice";

type ProductPriceAndStockProps = {
  initialPrice: number;
  initialStock: number;
  initialPurchaseLimitPerOrder: number;
  styles: Record<string, string>;
};

export default function ProductPriceAndStock({
  initialPrice,
  initialStock,
  initialPurchaseLimitPerOrder,
  styles,
}: ProductPriceAndStockProps) {
  const t = useTranslations("productPage");

  return (
    <>
      <p className={styles.productPrice}>{formatCents(initialPrice)}</p>
      <p className={styles.productStock}>
        {t("availability", {
          count: initialStock,
        })}
      </p>
      {initialPurchaseLimitPerOrder > 0 ? (
        <p className={styles.productStock}>
          {t("purchaseLimit", {
            count: initialPurchaseLimitPerOrder,
          })}
        </p>
      ) : null}
    </>
  );
}
