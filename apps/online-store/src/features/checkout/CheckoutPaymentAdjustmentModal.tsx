"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { Modal } from "@/components/Modal";
import { formatCents } from "@/utils/formatPrice";

import type { CheckoutCartProductItem } from "./cartState";
import type { CreatePaymentError, ValidatedPromoCode } from "./checkoutTypes";

import styles from "./CheckoutPaymentAdjustmentModal.module.css";

export type CheckoutPaymentAdjustmentError = Extract<
  CreatePaymentError,
  {
    code:
      | "PRODUCTS_NOT_PURCHASABLE"
      | "PRICE_MISMATCH"
      | "INSUFFICIENT_STOCK"
      | "PURCHASE_LIMIT_EXCEEDED";
  }
>;

type CheckoutPaymentAdjustmentModalProps = {
  error: CheckoutPaymentAdjustmentError | null;
  cartItems: CheckoutCartProductItem[];
  promoCode: string | null;
  promoTerms: ValidatedPromoCode | null;
  onAcceptChanges: (options: { shouldClearPromoCode: boolean }) => void;
  onGoBackToCart: () => void;
};

function getCartItemBySku(cartItems: CheckoutCartProductItem[], sku: string) {
  return cartItems.find((item) => item.product.sku === sku) ?? null;
}

function getAdjustedCartItems(
  cartItems: CheckoutCartProductItem[],
  error: CheckoutPaymentAdjustmentError,
) {
  switch (error.code) {
    case "PRODUCTS_NOT_PURCHASABLE":
      return cartItems.filter((item) => !error.data.skus.includes(item.product.sku));
    case "PRICE_MISMATCH":
      return cartItems.map((item) => {
        const entry = error.data.find((candidate) => candidate.sku === item.product.sku);
        if (!entry) {
          return item;
        }

        return {
          ...item,
          product: {
            ...item.product,
            priceCents: entry.newUnitPriceCents,
          },
        };
      });
    case "INSUFFICIENT_STOCK":
      return cartItems.flatMap((item) => {
        const entry = error.data.find((candidate) => candidate.sku === item.product.sku);
        if (!entry) {
          return [item];
        }

        if (entry.availableStock <= 0) {
          return [];
        }

        return [
          {
            ...item,
            quantity: entry.availableStock,
          },
        ];
      });
    case "PURCHASE_LIMIT_EXCEEDED":
      return cartItems.map((item) => {
        const entry = error.data.find((candidate) => candidate.sku === item.product.sku);
        if (!entry) {
          return item;
        }

        return {
          ...item,
          quantity: entry.purchaseLimit,
        };
      });
  }
}

function CartItemImage({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className={styles.imageWrap}>
      {src && <Image src={src} alt={alt} width={48} height={48} className={styles.image} />}
    </div>
  );
}

export function CheckoutPaymentAdjustmentModal({
  error,
  cartItems,
  promoCode,
  promoTerms,
  onAcceptChanges,
  onGoBackToCart,
}: CheckoutPaymentAdjustmentModalProps) {
  const t = useTranslations("checkout.paymentPage.adjustments");

  const shouldClearPromoCodeOnAccept = (() => {
    if (!error || !promoCode || promoTerms?.minimumItemsValueCents == null) {
      return false;
    }

    const adjustedCartItems = getAdjustedCartItems(cartItems, error);

    const adjustedSubtotal = adjustedCartItems.reduce(
      (total, item) => total + item.product.priceCents * item.quantity,
      0,
    );

    return adjustedSubtotal < promoTerms.minimumItemsValueCents;
  })();

  if (!error) {
    return null;
  }

  const adjustedCartItems = getAdjustedCartItems(cartItems, error);
  const willCartBeEmptyAfterAccept = adjustedCartItems.length === 0;

  const title = (() => {
    switch (error.code) {
      case "PRODUCTS_NOT_PURCHASABLE":
        return t("invalidItems.title");
      case "PRICE_MISMATCH":
        return t("priceChanged.title");
      case "INSUFFICIENT_STOCK":
        return t("stockChanged.title");
      case "PURCHASE_LIMIT_EXCEEDED":
        return t("purchaseLimitChanged.title");
    }
  })();

  const subtitle = (() => {
    switch (error.code) {
      case "PRODUCTS_NOT_PURCHASABLE":
        return t("invalidItems.description");
      case "PRICE_MISMATCH":
        return t("priceChanged.description");
      case "INSUFFICIENT_STOCK":
        return t("stockChanged.description");
      case "PURCHASE_LIMIT_EXCEEDED":
        return t("purchaseLimitChanged.description");
    }
  })();

  return (
    <Modal
      open
      onOpenChange={() => {}}
      title={title}
      subtitle={subtitle}
      dismissible={false}
      contentClassName={styles.content}
    >
      <div className={styles.list}>
        {error.code === "PRODUCTS_NOT_PURCHASABLE"
          ? error.data.skus.map((sku) => {
              const item = getCartItemBySku(cartItems, sku);
              if (!item) {
                return null;
              }

              return (
                <article key={sku} className={styles.item}>
                  <CartItemImage src={item.product.imageUrl} alt={item.product.name} />
                  <div className={styles.details}>
                    <p className={`${styles.productName} ${styles.productNameInvalid}`}>
                      {item.product.name}
                    </p>
                    <p className={styles.valueRow}>{t("invalidItems.value")}</p>
                  </div>
                </article>
              );
            })
          : error.code === "PRICE_MISMATCH"
            ? error.data.map((entry) => {
                const item = getCartItemBySku(cartItems, entry.sku);
                if (!item) {
                  return null;
                }

                return (
                  <article key={entry.sku} className={styles.item}>
                    <CartItemImage src={item.product.imageUrl} alt={item.product.name} />
                    <div className={styles.details}>
                      <p className={styles.productName}>{item.product.name}</p>
                      <p className={styles.valueRow}>
                        <span>{formatCents(item.product.priceCents)}</span>
                        <span className={styles.arrow}>{"->"}</span>
                        <span>{formatCents(entry.newUnitPriceCents)}</span>
                      </p>
                    </div>
                  </article>
                );
              })
            : error.code === "INSUFFICIENT_STOCK"
              ? error.data.map((entry) => {
                  const item = getCartItemBySku(cartItems, entry.sku);
                  if (!item) {
                    return null;
                  }

                  return (
                    <article key={entry.sku} className={styles.item}>
                      <CartItemImage src={item.product.imageUrl} alt={item.product.name} />
                      <div className={styles.details}>
                        <p className={styles.productName}>{item.product.name}</p>
                        <p className={styles.valueRow}>
                          <span>
                            {t("stockChanged.requested", {
                              quantity: item.quantity,
                            })}
                          </span>
                          <span className={styles.arrow}>{"->"}</span>
                          <span>
                            {t("stockChanged.available", {
                              quantity: entry.availableStock,
                            })}
                          </span>
                        </p>
                      </div>
                    </article>
                  );
                })
              : error.data.map((entry) => {
                  const item = getCartItemBySku(cartItems, entry.sku);
                  if (!item) {
                    return null;
                  }

                  return (
                    <article key={entry.sku} className={styles.item}>
                      <CartItemImage src={item.product.imageUrl} alt={item.product.name} />
                      <div className={styles.details}>
                        <p className={styles.productName}>{item.product.name}</p>
                        <p className={styles.valueRow}>
                          <span>
                            {t("stockChanged.requested", {
                              quantity: item.quantity,
                            })}
                          </span>
                          <span className={styles.arrow}>{"->"}</span>
                          <span>
                            {t("purchaseLimitChanged.limit", {
                              quantity: entry.purchaseLimit,
                            })}
                          </span>
                        </p>
                      </div>
                    </article>
                  );
                })}
      </div>

      {willCartBeEmptyAfterAccept ? (
        <p className={styles.promoRemovalNote}>{t("cannotResumeEmptyCart")}</p>
      ) : shouldClearPromoCodeOnAccept ? (
        <p className={styles.promoRemovalNote}>
          {t("promoCodeRemoved", { code: promoCode || "" })}
        </p>
      ) : null}

      <div className={styles.actions}>
        {!willCartBeEmptyAfterAccept ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              onAcceptChanges({
                shouldClearPromoCode: shouldClearPromoCodeOnAccept,
              })
            }
          >
            {t("actions.accept")}
          </button>
        ) : null}
        <button type="button" className={styles.secondaryButton} onClick={onGoBackToCart}>
          {t("actions.goBack")}
        </button>
      </div>
    </Modal>
  );
}
