"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";

import Collapsible from "@/components/collapsible/Collapsible";
import { useCart } from "@/hooks/useCart";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/utils/formatPrice";

import {
  buildCheckoutCartItems,
  type CartItems,
  type CheckoutCartProductItem,
  getCartTotalQuantity,
  getCheckoutSubtotal,
} from "./cartState";
import { CheckoutCartItems } from "./CheckoutCartItems";
import { CheckoutEmptySavedCartAction } from "./CheckoutEmptySavedCartAction";
import { CheckoutSummary } from "./CheckoutSummary";
import type { DeliveryFeeEstimate } from "./checkoutTypes";
import type { CheckoutCartAdjustmentNotice } from "./getCheckoutServerState";

import styles from "./CheckoutPage.module.css";

type CheckoutPageClientProps = {
  initialCart: CartItems;
  initialCartUpdatedAt: number | null;
  initialCartItems: CheckoutCartProductItem[];
  availableProducts: CheckoutCartProductItem["product"][];
  cartAdjustmentNotice: CheckoutCartAdjustmentNotice | null;
  initialDeliveryFee: DeliveryFeeEstimate | undefined;
  emptyTitle: string;
  emptyContinueLabel: string;
};

export function CheckoutPageClient({
  initialCart,
  initialCartUpdatedAt,
  initialCartItems,
  availableProducts,
  cartAdjustmentNotice,
  initialDeliveryFee,
  emptyTitle,
  emptyContinueLabel,
}: CheckoutPageClientProps) {
  const t = useTranslations("checkout");
  const { hasHydrated, items, replaceCart, updatedAt } = useCart();
  const [hasPersistedInitialCart, setHasPersistedInitialCart] = useState(false);

  useEffect(() => {
    if (!hasHydrated || hasPersistedInitialCart) {
      return;
    }

    if (updatedAt !== initialCartUpdatedAt) {
      setHasPersistedInitialCart(true);
      return;
    }

    void replaceCart({ items: initialCart }).then(() => setHasPersistedInitialCart(true));
  }, [
    hasHydrated,
    hasPersistedInitialCart,
    initialCartUpdatedAt,
    initialCart,
    replaceCart,
    updatedAt,
  ]);

  const cartItems =
    hasHydrated && hasPersistedInitialCart
      ? buildCheckoutCartItems(availableProducts, items)
      : initialCartItems;
  const totalItemCount = getCartTotalQuantity(
    hasHydrated && hasPersistedInitialCart ? items : initialCart,
  );
  const subtotal = getCheckoutSubtotal(cartItems);
  const formattedDeliveryFeeStart = initialDeliveryFee
    ? formatPrice(initialDeliveryFee.deliveryFeeCents / 100)
    : null;
  const cartAdjustmentNoticeContent = cartAdjustmentNotice ? (
    <Collapsible
      title={t("adjustments.title")}
      icon={<Info size={18} strokeWidth={2.2} />}
      className={styles.adjustmentsNotice}
      contentClassName={styles.adjustmentsContent}
    >
      <div className={styles.adjustmentsList}>
        {cartAdjustmentNotice.changedItems.map((item) => (
          <article key={item.sku} className={styles.adjustmentItem}>
            <div className={styles.adjustmentImageWrap}>
              <Image
                className={styles.adjustmentImage}
                src={item.productImageUrl}
                alt={item.productName}
                width={64}
                height={64}
              />
            </div>

            <div className={styles.adjustmentDetails}>
              {item.oldUnitPrice != null ? (
                <p className={styles.adjustmentValue}>
                  <span>{formatPrice(item.oldUnitPrice)}</span>
                  <span className={styles.adjustmentArrow}>{"->"}</span>
                  <span>{formatPrice(item.newUnitPrice)}</span>
                </p>
              ) : null}

              {item.oldQuantity != null ? (
                <p className={styles.adjustmentValue}>
                  <span>
                    {t("adjustments.quantityValue", {
                      quantity: item.oldQuantity,
                    })}
                  </span>
                  <span className={styles.adjustmentArrow}>{"->"}</span>
                  <span>
                    {t("adjustments.quantityValue", {
                      quantity: item.newQuantity,
                    })}
                  </span>
                </p>
              ) : null}
            </div>
          </article>
        ))}

        {cartAdjustmentNotice.removedItemCount > 0 ? (
          <p className={styles.adjustmentRemovedMessage}>
            {t("adjustments.removedItems", {
              count: cartAdjustmentNotice.removedItemCount,
            })}
          </p>
        ) : null}
      </div>
    </Collapsible>
  ) : null;

  const content =
    cartItems.length === 0 ? (
      <section className={styles.emptyState}>
        <h1 className={styles.emptyTitle}>{emptyTitle}</h1>
        <CheckoutEmptySavedCartAction />
        <Link href="/" className={`${styles.primaryButton} ${styles.emptyPrimaryAction}`}>
          {emptyContinueLabel}
        </Link>
      </section>
    ) : (
      <>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderRow}>
            <h1 className={styles.pageTitle}>{t("pageTitle")}</h1>
            <span className={styles.pageCountBadge}>{totalItemCount}</span>
          </div>
        </header>

        <div className={styles.pageLayout}>
          <CheckoutCartItems items={cartItems} />

          <CheckoutSummary
            estimatedSubtotalLabel={t("summary.estimatedSubtotal")}
            note={t("summary.note")}
            continueLabel={t("summary.payAtCheckout")}
            deliveryFeeStartsFromLabel={t("summary.deliveryFeeStartsFrom")}
            subtotal={subtotal}
            formattedSubtotal={formatPrice(subtotal)}
            formattedDeliveryFeeStart={formattedDeliveryFeeStart}
            freeDeliveryThreshold={initialDeliveryFee?.discountThreshold ?? null}
            checkoutHref="/checkout"
          />
        </div>
      </>
    );

  return (
    <>
      {cartAdjustmentNoticeContent}
      {content}
    </>
  );
}
