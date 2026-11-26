"use client";

import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { SiteHeader } from "./SiteHeader";

import styles from "./SiteHeader.module.css";

export function CheckoutHeader() {
  const t = useTranslations("checkoutHeader");

  return (
    <SiteHeader
      leftAlignedLogo={true}
      rightSlot={
        <Link href="/cart" className={styles.returnLink}>
          <ShoppingCart size={24} aria-hidden="true" />
          <span className={styles.returnLinkLabel}>{t("returnToShoppingCart")}</span>
        </Link>
      }
    />
  );
}
