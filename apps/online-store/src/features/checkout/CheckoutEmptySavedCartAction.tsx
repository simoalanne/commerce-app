"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/features/auth/clerk";
import { type CartItems, getProductMaxOrderQuantity } from "@/features/checkout/cartState";
import { useCart } from "@/hooks/useCart";
import { useApiClient } from "@/providers/ApiClientProvider";

import styles from "./CheckoutPage.module.css";

export function CheckoutEmptySavedCartAction() {
  const t = useTranslations("checkout.emptySavedCart");
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { replaceCart } = useCart();
  const { queryUtils } = useApiClient();
  const queryClient = useQueryClient();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const clearSavedCart = useMutation({
    ...queryUtils.user.account.setSavedCart.mutationOptions(),
    onSuccess() {
      void queryClient.invalidateQueries({
        queryKey: queryUtils.user.account.getSavedCart.queryKey(),
      });
    },
  });

  const { data: savedCart = [], isLoading } = useQuery(
    queryUtils.user.account.getSavedCart.queryOptions({
      enabled: isSignedIn ?? false,
      select: (response) => response.body,
    }),
  );
  const { data: products = [], isLoading: isLoadingProducts } = useQuery(
    queryUtils.products.getAll.queryOptions({
      enabled: !!isSignedIn && savedCart.length > 0,
      select: (response) => response.body,
    }),
  );

  const savedProductsById = new Map(savedCart.map((item) => [item.productId, item]));
  const cartItems = products.reduce((items, product) => {
    const savedItem = savedProductsById.get(product.id);
    if (!savedItem) {
      return items;
    }

    const maxQuantity = getProductMaxOrderQuantity(product);
    if (maxQuantity <= 0) {
      return items;
    }

    items[product.sku] = {
      quantity: Math.min(savedItem.quantity, maxQuantity),
      unitPrice: product.price,
    };
    return items;
  }, {} as CartItems);

  const hasSavedCart = savedCart.length > 0;
  const hasUsableSavedCart = Object.keys(cartItems).length > 0;
  const isUsingSavedCart = isLoading || isLoadingProducts;
  const isDeletingSavedCart = clearSavedCart.isPending;
  const isUseDisabled =
    !isSignedIn || !hasSavedCart || !hasUsableSavedCart || isUsingSavedCart || isDeletingSavedCart;
  const isDeleteDisabled = !isSignedIn || !hasSavedCart || isUsingSavedCart || isDeletingSavedCart;

  const handleUseSavedCart = async () => {
    if (!hasUsableSavedCart) {
      return;
    }

    await replaceCart({ items: cartItems });
    router.refresh();
  };

  const handleDeleteSavedCart = () => {
    if (!hasSavedCart) {
      return;
    }

    clearSavedCart.mutate({ body: { items: [] } });
  };

  const signInState = (
    <div className={styles.emptySavedCartAction}>
      <p className={styles.emptySavedCartMessage}>
        {t.rich("signInPrompt", {
          action: (chunks) => (
            <button
              type="button"
              className={styles.emptySavedCartButton}
              onClick={() => setIsAuthModalOpen(true)}
            >
              {chunks}
            </button>
          ),
        })}
      </p>
      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />
    </div>
  );

  if (!isLoaded || !isSignedIn) {
    return signInState;
  }

  if (isLoading) {
    return signInState;
  }

  if (!hasSavedCart) {
    return null;
  }

  return (
    <div className={styles.emptySavedCartAction}>
      <div className={styles.emptySavedCartLinks}>
        <button
          type="button"
          className={styles.emptySavedCartButton}
          disabled={isUseDisabled}
          onClick={handleUseSavedCart}
        >
          {t("use")}
        </button>
        <span className={styles.emptySavedCartDivider} aria-hidden="true">
          |
        </span>
        <button
          type="button"
          className={`${styles.emptySavedCartButton} ${styles.emptySavedCartButtonMuted}`}
          disabled={isDeleteDisabled}
          onClick={handleDeleteSavedCart}
        >
          {isDeletingSavedCart ? t("deleting") : t("delete")}
        </button>
      </div>
    </div>
  );
}
