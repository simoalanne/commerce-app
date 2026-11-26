"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useAuth } from "@/features/auth/clerk";
import { useCart } from "@/hooks/useCart";
import { useApiClient } from "@/providers/ApiClientProvider";

import styles from "./CheckoutPage.module.css";

export function CheckoutSummarySavedCartAction() {
  const t = useTranslations("checkout.summary.savedCart");
  const { isSignedIn } = useAuth();
  const { queryUtils } = useApiClient();
  const queryClient = useQueryClient();
  const { items: currentItems } = useCart();

  const saveDefaultCart = useMutation(queryUtils.user.account.setSavedCart.mutationOptions());
  const { data: savedCart = [], isLoading } = useQuery(
    queryUtils.user.account.getSavedCart.queryOptions({
      enabled: isSignedIn ?? false,
      select: (response) => response.body,
    }),
  );
  const { data: products = [], isLoading: isLoadingProducts } = useQuery(
    queryUtils.products.getAll.queryOptions({
      enabled: !!isSignedIn && Object.keys(currentItems).length > 0,
      select: (response) => response.body,
    }),
  );

  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  const savedCartItemsByProductId = new Map(savedCart.map((item) => [item.productId, item]));

  const nextSavedCart = Object.entries(currentItems).flatMap(([sku, item]) => {
    const product = productsBySku.get(sku);
    if (!product) {
      return [];
    }

    return [
      {
        productId: product.id,
        quantity: item.quantity,
      },
    ];
  });

  const savedCurrentProductCount = Object.entries(currentItems).filter(([sku]) =>
    productsBySku.has(sku),
  ).length;

  const isCartSaved =
    savedCart.length === savedCurrentProductCount &&
    nextSavedCart.every(
      (item) => savedCartItemsByProductId.get(item.productId)?.quantity === item.quantity,
    );

  const hasCurrentCart = Object.keys(currentItems).length > 0;

  const isDisabled =
    !isSignedIn ||
    !hasCurrentCart ||
    isLoading ||
    isLoadingProducts ||
    saveDefaultCart.isPending ||
    isCartSaved ||
    nextSavedCart.length === 0;

  const handleSaveCart = () => {
    if (!hasCurrentCart || nextSavedCart.length === 0) return;

    saveDefaultCart.mutate(
      {
        body: { items: nextSavedCart },
      },
      {
        onSuccess() {
          void queryClient.invalidateQueries({
            queryKey: queryUtils.user.account.getSavedCart.queryKey(),
          });
        },
      },
    );
  };

  const label = !isSignedIn
    ? t("signIn")
    : saveDefaultCart.isPending
      ? t("saving")
      : isCartSaved
        ? t("saved")
        : t("save");

  return (
    <div className={styles.summarySavedCartAction}>
      <button
        type="button"
        className={`${styles.secondaryButton} ${styles.summarySecondaryButton}`}
        disabled={isDisabled}
        onClick={handleSaveCart}
      >
        {label}
      </button>
    </div>
  );
}
