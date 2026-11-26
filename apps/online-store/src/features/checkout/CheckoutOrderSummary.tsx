"use client";

import { calculateOrderPricing } from "@acme/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { formatCents } from "@/utils/formatPrice";

import { type CheckoutCartProductItem, getCheckoutSubtotal } from "./cartState";
import { CheckoutPromoCodeSection } from "./CheckoutPromoCodeSection";
import type { CheckoutPromoCodeState, ValidatedPromoCode } from "./checkoutTypes";

import styles from "./CheckoutOrderSummary.module.css";

type CheckoutOrderSummaryProps = {
  cartItems: CheckoutCartProductItem[];
  promoCodeState: CheckoutPromoCodeState;
  setPromoCodeState: (updater: (current: CheckoutPromoCodeState) => CheckoutPromoCodeState) => void;
  validatedPromoCode: ValidatedPromoCode | null;
  validatePromoCode: () => Promise<{ success: true } | { success: false }>;
  clearSubmitError: () => void;
};

export function CheckoutOrderSummary({
  cartItems,
  promoCodeState,
  setPromoCodeState,
  validatedPromoCode,
  validatePromoCode,
  clearSubmitError,
}: CheckoutOrderSummaryProps) {
  const t = useTranslations("checkout");
  const subtotal = getCheckoutSubtotal(cartItems);
  const pricingSnapshot = calculateOrderPricing({
    itemsSubtotalCents: subtotal,
    discountType: validatedPromoCode?.discountType,
    discountValue: validatedPromoCode?.discountValue,
  });

  return (
    <aside className={styles.summaryCard}>
      <div className={styles.summaryDetails}>
        <div className={styles.summaryDetailsInner}>
          <div className={styles.summaryItems}>
            {cartItems.map((item) => {
              const productHref = `/products/${item.product.slug}`;

              return (
                <article key={item.product.sku} className={styles.summaryItem}>
                  <div className={styles.summaryItemMedia}>
                    {item.product.imageUrl ? (
                      productHref ? (
                        <Link href={productHref} aria-label={item.product.name}>
                          <div className={styles.imageWrapper}>
                            <Image
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              fill
                              sizes="3rem"
                              className={styles.summaryItemImage}
                            />
                          </div>
                        </Link>
                      ) : (
                        <div className={styles.imageWrapper}>
                          <Image
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            fill
                            sizes="3rem"
                            className={styles.summaryItemImage}
                          />
                        </div>
                      )
                    ) : productHref ? (
                      <Link href={productHref} aria-label={item.product.name}>
                        <div className={styles.summaryItemFallback} aria-hidden="true">
                          {item.product.name.slice(0, 1)}
                        </div>
                      </Link>
                    ) : (
                      <div className={styles.summaryItemFallback} aria-hidden="true">
                        {item.product.name.slice(0, 1)}
                      </div>
                    )}
                    <span className={styles.summaryQuantityBadge}>{item.quantity}</span>
                  </div>
                  <div className={styles.summaryItemMain}>
                    {productHref ? (
                      <Link
                        href={productHref}
                        className={styles.summaryItemName}
                        style={{ textDecoration: "none" }}
                      >
                        {item.product.name}
                      </Link>
                    ) : (
                      <p className={styles.summaryItemName}>{item.product.name}</p>
                    )}
                    <strong className={styles.summaryItemPrice}>
                      {formatCents(item.product.priceCents * item.quantity)}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>

          <CheckoutPromoCodeSection
            state={promoCodeState}
            setState={setPromoCodeState}
            validatePromoCode={validatePromoCode}
            clearSubmitError={clearSubmitError}
          />

          <div className={styles.summaryTotals}>
            <div className={styles.summaryRow}>
              <span>{t("orderSummary.itemsSubtotal")}</span>
              <strong>{formatCents(pricingSnapshot.itemsSubtotalCents)}</strong>
            </div>
            {pricingSnapshot.itemsDiscountCents !== null ? (
              <>
                <div className={styles.summaryRow}>
                  <span>{t("orderSummary.itemDiscount")}</span>
                  <span>-{formatCents(pricingSnapshot.itemsDiscountCents)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>{t("orderSummary.discountedItemsSubtotal")}</span>
                  <span>
                    {formatCents(
                      pricingSnapshot.discountedItemsSubtotalCents ??
                        pricingSnapshot.itemsSubtotalCents,
                    )}
                  </span>
                </div>
              </>
            ) : null}
            <div className={styles.summaryRowTotal}>
              <span>{t("orderSummary.total")}</span>
              <strong>{formatCents(pricingSnapshot.chargedTotalCents)}</strong>
            </div>
            <div className={styles.summaryRowTax}>
              <span>
                {t("orderSummary.includedVat", {
                  rate: pricingSnapshot.vatRate,
                })}
              </span>
              <span>{formatCents(pricingSnapshot.includedVatCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
