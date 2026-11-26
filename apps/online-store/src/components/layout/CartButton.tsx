"use client";

import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

import { getCartTotalQuantity } from "@/features/checkout/cartState";
import { useCart } from "@/hooks/useCart";
import { Link } from "@/i18n/navigation";

import styles from "./CartButton.module.css";

type CartButtonProps = {
  variant?: "storefront" | "landing";
};

export function CartButton({ variant = "storefront" }: CartButtonProps) {
  const t = useTranslations();
  const { items } = useCart();
  const totalQuantity = getCartTotalQuantity(items);
  const triggerClassName =
    variant === "landing" ? styles.cartLinkLanding : styles.cartLinkStorefront;
  const iconClassName =
    variant === "landing" ? `${styles.icon} ${styles.iconLanding}` : styles.icon;

  return (
    <Link
      href="/cart"
      id="storefront-cart-trigger"
      className={triggerClassName}
      prefetch={false}
      aria-label={t("header.arialabels.cartBtn")}
    >
      <ShoppingCart className={iconClassName} strokeWidth={2.2} />
      {totalQuantity > 0 ? <span className={styles.badge}>{totalQuantity}</span> : null}
    </Link>
  );
}
