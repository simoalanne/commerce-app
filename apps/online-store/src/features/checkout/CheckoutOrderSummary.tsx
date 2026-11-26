"use client";

import { calculateOrderPricing } from "@acme/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/utils/formatPrice";

import { type CheckoutCartProductItem, getCheckoutSubtotal } from "./cartState";
import { CheckoutPromoCodeSection } from "./CheckoutPromoCodeSection";
import type {
  CheckoutPromoCodeState,
  DeliveryFeeEstimate,
  ValidatedPromoCode,
} from "./checkoutTypes";

import styles from "./CheckoutOrderSummary.module.css";

type CheckoutOrderSummaryProps = {
  cartItems: CheckoutCartProductItem[];
  tipPercentage: number;
  deliveryFee: DeliveryFeeEstimate | undefined;
  deliveryFeeLoading: boolean;
  deliveryFeeError: boolean;
  promoCodeState: CheckoutPromoCodeState;
  setPromoCodeState: (updater: (current: CheckoutPromoCodeState) => CheckoutPromoCodeState) => void;
  validatedPromoCode: ValidatedPromoCode | null;
  validatePromoCode: () => Promise<{ success: true } | { success: false }>;
  clearSubmitError: () => void;
};

export function CheckoutOrderSummary({
  cartItems,
  tipPercentage,
  deliveryFee,
  deliveryFeeLoading,
  deliveryFeeError,
  promoCodeState,
  setPromoCodeState,
  validatedPromoCode,
  validatePromoCode,
  clearSubmitError,
}: CheckoutOrderSummaryProps) {
  const t = useTranslations("checkout");
  const subtotal = getCheckoutSubtotal(cartItems);
  const deliveryFeeAmount = deliveryFee ? deliveryFee.deliveryFeeCents / 100 : 0;
  const pricingSnapshot = calculateOrderPricing({
    itemsSubtotal: subtotal,
    deliveryFee: deliveryFeeAmount,
    tipPercentage,
    discountType: validatedPromoCode?.discountType,
    discountValue: validatedPromoCode?.discountValue,
  });
  const totalValue = deliveryFeeLoading
    ? t("orderSummary.calculating")
    : deliveryFeeError
      ? t("orderSummary.error")
      : deliveryFee != null
        ? formatPrice(pricingSnapshot.chargedTotal)
        : t("orderSummary.selectAddress");

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
                      {formatPrice(item.product.price * item.quantity)}
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
              <strong>{formatPrice(pricingSnapshot.itemsSubtotal)}</strong>
            </div>
            {pricingSnapshot.itemsDiscountAmount !== null ? (
              <>
                <div className={styles.summaryRow}>
                  <span>{t("orderSummary.itemDiscount")}</span>
                  <span>-{formatPrice(pricingSnapshot.itemsDiscountAmount)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>{t("orderSummary.discountedItemsSubtotal")}</span>
                  <span>
                    {formatPrice(
                      pricingSnapshot.discountedItemsSubtotal ?? pricingSnapshot.itemsSubtotal,
                    )}
                  </span>
                </div>
              </>
            ) : null}
            <div className={styles.summaryRow}>
              <span>{t("orderSummary.delivery")}</span>
              <span>
                {deliveryFeeLoading
                  ? t("orderSummary.calculating")
                  : deliveryFeeError
                    ? t("orderSummary.error")
                    : deliveryFee != null
                      ? formatPrice(deliveryFee.deliveryFeeCents / 100)
                      : t("orderSummary.selectAddress")}
              </span>
            </div>
            {pricingSnapshot.deliveryDiscountAmount !== null ? (
              <>
                <div className={styles.summaryRow}>
                  <span>{t("orderSummary.deliveryDiscount")}</span>
                  <span>-{formatPrice(pricingSnapshot.deliveryDiscountAmount)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>{t("orderSummary.discountedDelivery")}</span>
                  <span>
                    {formatPrice(
                      pricingSnapshot.discountedDeliveryFee ?? pricingSnapshot.deliveryFee,
                    )}
                  </span>
                </div>
              </>
            ) : null}
            {pricingSnapshot.tipAmount !== null ? (
              <div className={styles.summaryRow}>
                <span>
                  {pricingSnapshot.tipPercentage !== null
                    ? t("orderSummary.tipWithPercentage", {
                        percentage: pricingSnapshot.tipPercentage,
                      })
                    : t("orderSummary.tip")}
                </span>
                <span>{formatPrice(pricingSnapshot.tipAmount)}</span>
              </div>
            ) : null}
            <div className={styles.summaryRowTotal}>
              <span>{t("orderSummary.total")}</span>
              <strong>{totalValue}</strong>
            </div>
            <div className={styles.summaryRowTax}>
              <span>
                {t("orderSummary.includedVat", {
                  rate: pricingSnapshot.vatRate,
                })}
              </span>
              <span>{formatPrice(pricingSnapshot.includedVatAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
