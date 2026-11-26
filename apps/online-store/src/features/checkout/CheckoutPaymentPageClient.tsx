"use client";

import { calculateOrderPricing } from "@acme/shared";
import { isDefinedError, safe } from "@rest-rpc/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";

import { useCart } from "@/hooks/useCart";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useApiClient } from "@/providers/ApiClientProvider";
import { formatPrice } from "@/utils/formatPrice";

import {
  buildCheckoutCartItems,
  type CartItems,
  type CheckoutCartProductItem,
  getCheckoutSubtotal,
} from "./cartState";
import CheckoutFormDetails from "./CheckoutFormDetails";
import { CheckoutOrderSummary } from "./CheckoutOrderSummary";
import {
  type CheckoutPaymentAdjustmentError,
  CheckoutPaymentAdjustmentModal,
} from "./CheckoutPaymentAdjustmentModal";
import type { CheckoutTermsDocument } from "./CheckoutTermsAcceptance";
import type { DeliveryFeeEstimate, PaymentMethod } from "./checkoutTypes";
import {
  type CheckoutFormState,
  type CheckoutPromoCodeState,
  checkoutRecoveryDraftStorageKey,
  createCheckoutRecoveryDraft,
  initialCheckoutFormState,
  initialCheckoutPromoCodeState,
  reviveCheckoutRecoveryDraft,
} from "./checkoutTypes";
import { clearActivePaytrailPayment } from "./paytrailActivePayment";

import styles from "./CheckoutPaymentPage.module.css";

type CheckoutPaymentPageClientProps = {
  initialCart: CartItems;
  initialCartUpdatedAt: number | null;
  initialIsPaymentCanceled: boolean;
  cartItems: CheckoutCartProductItem[];
  availableProducts: CheckoutCartProductItem["product"][];
  initialDeliveryFee: DeliveryFeeEstimate | undefined;
  paymentMethods: PaymentMethod[];
  termsDocument: CheckoutTermsDocument;
};

export function CheckoutPaymentPageClient({
  initialCart,
  initialCartUpdatedAt,
  initialIsPaymentCanceled,
  cartItems,
  availableProducts,
  initialDeliveryFee,
  paymentMethods,
  termsDocument,
}: CheckoutPaymentPageClientProps) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const pathname = usePathname();
  const { queryUtils } = useApiClient();
  const [formState, setFormState] = useState<CheckoutFormState>(initialCheckoutFormState);
  const [promoCodeState, setPromoCodeState] = useState<CheckoutPromoCodeState>(
    initialCheckoutPromoCodeState,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<CheckoutPaymentAdjustmentError | null>(
    null,
  );
  const [hasPersistedInitialCart, setHasPersistedInitialCart] = useState(false);
  const { hasHydrated, items, replaceCart, updatedAt } = useCart();
  const isCartEmpty = Object.keys(items).length === 0;
  const displayedCartItems =
    hasHydrated && hasPersistedInitialCart
      ? buildCheckoutCartItems(availableProducts, items)
      : cartItems;
  const subtotal = getCheckoutSubtotal(displayedCartItems);
  const pricingPreview = calculateOrderPricing({
    itemsSubtotal: subtotal,
    deliveryFee: 0,
    discountType: promoCodeState.validatedPromoCode?.discountType,
    discountValue: promoCodeState.validatedPromoCode?.discountValue,
  });
  const effectiveItemsSubtotal =
    pricingPreview.discountedItemsSubtotal ?? pricingPreview.itemsSubtotal;
  const {
    data: deliveryFeeResponse,
    isLoading: deliveryFeeLoading,
    error: deliveryFeeError,
  } = useQuery(
    queryUtils.checkout.estimateDeliveryFee.queryOptions({
      request: {
        body: { itemsSubtotal: subtotal },
      },
    }),
  );
  const deliveryFee = deliveryFeeResponse?.body ?? initialDeliveryFee;

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
    initialCart,
    initialCartUpdatedAt,
    replaceCart,
    updatedAt,
  ]);

  useEffect(() => {
    if (!initialIsPaymentCanceled) {
      return;
    }

    const savedDraft = window.localStorage.getItem(checkoutRecoveryDraftStorageKey);

    if (savedDraft) {
      const restoredDraft = reviveCheckoutRecoveryDraft(savedDraft);
      if (restoredDraft) {
        setFormState(restoredDraft.formState);
        setPromoCodeState(restoredDraft.promoCodeState ?? initialCheckoutPromoCodeState);
      }
    }

    clearActivePaytrailPayment();
    router.replace(pathname);
  }, [initialIsPaymentCanceled, pathname, router]);

  useEffect(() => {
    if (!hasHydrated || !isCartEmpty) {
      return;
    }

    router.replace("/cart");
  }, [hasHydrated, isCartEmpty, router]);

  const handleGoBackToCart = () => {
    router.replace("/cart");
  };

  const validatePromoCode = async () => {
    const promoCode = promoCodeState.input.trim();

    if (!promoCode) {
      setPromoCodeState(() => initialCheckoutPromoCodeState);
      return { success: false as const };
    }

    setPromoCodeState((current) => ({
      ...current,
      input: promoCode,
      appliedCode: null,
      validatedPromoCode: null,
      validationError: null,
      isValidating: true,
    }));

    const [safeResult] = await Promise.all([
      safe(
        queryUtils.checkout.validatePromoCode.fetch({
          body: {
            promoCode,
            itemsSubtotal: subtotal,
          },
        }),
      ),
      // NOTE: Artificial delay so promo code validation feels meaningful
      // action and not instantaneous.
      new Promise((resolve) => setTimeout(resolve, 750)),
    ]);

    if (safeResult.error) {
      const resultError = safeResult.error;
      const validationError = isDefinedError(resultError)
        ? match(resultError)
            .with({ code: "PROMO_CODE_NOT_FOUND" }, () => t("form.promoCode.errors.notFound"))
            .with({ code: "PROMO_CODE_INACTIVE" }, () => t("form.promoCode.errors.inactive"))
            .with({ code: "PROMO_CODE_NOT_STARTED" }, () => t("form.promoCode.errors.notStarted"))
            .with({ code: "PROMO_CODE_EXPIRED" }, () => t("form.promoCode.errors.expired"))
            .with({ code: "PROMO_CODE_USAGE_LIMIT_REACHED" }, () =>
              t("form.promoCode.errors.usageLimitReached"),
            )
            .with(
              { code: "PROMO_CODE_MINIMUM_ITEMS_VALUE_NOT_MET" },
              ({ data: { minimumItemsValue } }) =>
                t("form.promoCode.errors.minimumItemsValueNotMet", {
                  minimumItemsValue: formatPrice(minimumItemsValue),
                }),
            )
            .with(
              {
                code: P.union("UNAUTHORIZED", "FORBIDDEN", "RATE_LIMIT_EXCEEDED"),
              },
              () => t("form.promoCode.errors.unexpected"),
            )
            .exhaustive()
        : t("form.promoCode.errors.unexpected");
      setPromoCodeState((current) => ({
        ...current,
        appliedCode: null,
        validatedPromoCode: null,
        validationError,
        isValidating: false,
      }));
      return { success: false as const };
    }

    setPromoCodeState((current) => ({
      ...current,
      appliedCode: promoCode,
      validatedPromoCode: safeResult.data.body,
      validationError: null,
      isValidating: false,
    }));
    return { success: true as const };
  };

  const handleAcceptChanges = ({ shouldClearPromoCode }: { shouldClearPromoCode: boolean }) => {
    if (!adjustmentError) {
      return;
    }

    const currentItems = hasHydrated && hasPersistedInitialCart ? items : initialCart;
    const nextItems = { ...currentItems };

    switch (adjustmentError.code) {
      case "PRODUCTS_NOT_PURCHASABLE":
        adjustmentError.data.skus.forEach((sku) => {
          delete nextItems[sku];
        });
        break;
      case "PRICE_MISMATCH":
        adjustmentError.data.forEach(({ sku, newUnitPrice }) => {
          const existing = nextItems[sku];
          if (!existing) {
            return;
          }
          nextItems[sku] = {
            ...existing,
            unitPrice: newUnitPrice,
          };
        });
        break;
      case "INSUFFICIENT_STOCK":
        adjustmentError.data.forEach(({ sku, availableStock }) => {
          if (availableStock <= 0) {
            delete nextItems[sku];
            return;
          }
          const existing = nextItems[sku];
          if (!existing) {
            return;
          }
          nextItems[sku] = {
            ...existing,
            quantity: availableStock,
          };
        });
        break;
      case "PURCHASE_LIMIT_EXCEEDED":
        adjustmentError.data.forEach(({ sku, purchaseLimit }) => {
          const existing = nextItems[sku];
          if (!existing) {
            return;
          }
          nextItems[sku] = {
            ...existing,
            quantity: purchaseLimit,
          };
        });
        break;
    }

    setAdjustmentError(null);
    if (shouldClearPromoCode) {
      setPromoCodeState(() => initialCheckoutPromoCodeState);
    }
    void replaceCart({ items: nextItems }).then(() => {
      if (Object.keys(nextItems).length === 0) {
        router.replace("/cart");
        return;
      }

      router.refresh();
    });
  };

  return (
    <>
      <CheckoutPaymentAdjustmentModal
        error={adjustmentError}
        cartItems={displayedCartItems}
        promoCode={promoCodeState.appliedCode}
        promoTerms={promoCodeState.validatedPromoCode}
        onAcceptChanges={handleAcceptChanges}
        onGoBackToCart={handleGoBackToCart}
      />

      <div className={styles.pageLayout}>
        <div className={styles.formSection}>
          <CheckoutFormDetails
            formState={formState}
            setFormState={setFormState}
            appliedPromoCode={promoCodeState.appliedCode}
            submitError={submitError}
            setSubmitError={setSubmitError}
            invalidatePromoCode={() =>
              setPromoCodeState((current) => ({
                ...current,
                appliedCode: null,
                validatedPromoCode: null,
                validationError: t("form.errors.invalidPromoCode"),
                isValidating: false,
              }))
            }
            cartItems={displayedCartItems}
            effectiveItemsSubtotal={effectiveItemsSubtotal}
            paymentMethods={paymentMethods}
            onAdjustmentRequired={setAdjustmentError}
            persistRecoveryDraft={(nextFormState, nextPromoCodeState) => {
              window.localStorage.setItem(
                checkoutRecoveryDraftStorageKey,
                JSON.stringify(createCheckoutRecoveryDraft(nextFormState, nextPromoCodeState)),
              );
            }}
            promoCodeState={promoCodeState}
            termsDocument={termsDocument}
          />
        </div>
        <CheckoutOrderSummary
          cartItems={displayedCartItems}
          tipPercentage={formState.tipPercentage}
          deliveryFee={deliveryFee}
          deliveryFeeLoading={deliveryFeeLoading}
          deliveryFeeError={deliveryFeeError != null}
          promoCodeState={promoCodeState}
          setPromoCodeState={setPromoCodeState}
          validatedPromoCode={promoCodeState.validatedPromoCode}
          validatePromoCode={validatePromoCode}
          clearSubmitError={() => setSubmitError(null)}
        />
      </div>
    </>
  );
}
