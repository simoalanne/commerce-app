"use client";

import { useTranslations } from "next-intl";

import { formatPrice, formatPricePerKg } from "@/utils/formatPrice";

type ProductPriceAndStockProps = {
  initialPrice: number;
  initialStock: number;
  initialPurchaseLimitPerOrder: number;
  initialPricePerKg?: number;
  styles: Record<string, string>;
};

export default function ProductPriceAndStock({
  initialPrice,
  initialStock,
  initialPurchaseLimitPerOrder,
  initialPricePerKg,
  styles,
}: ProductPriceAndStockProps) {
  const t = useTranslations("productPage");

  return (
    <>
      <p className={styles.productPrice}>{formatPrice(initialPrice)}</p>
      {initialPricePerKg && (
        <p className={styles.productPriceKG}>{formatPricePerKg(initialPricePerKg)}</p>
      )}
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
