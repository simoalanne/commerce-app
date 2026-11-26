"use client";

import { useTranslations } from "next-intl";

import VendorCard from "@/components/vendors/VendorCard";
import type { VendorSummary } from "@/types/api";

import { useFavoriteVendorsList } from "./useFavoriteVendorsList";

import styles from "./FavoriteVendorsPageClient.module.css";

type FavoriteVendorsPageClientProps = {
  vendors: VendorSummary[];
};

export default function FavoriteVendorsPageClient({ vendors }: FavoriteVendorsPageClientProps) {
  const t = useTranslations("vendorListing.favoritesPage");
  const { isLoaded, isSignedIn, isLoading, favoriteVendorList } = useFavoriteVendorsList(vendors);

  if (!isLoaded || !isSignedIn || isLoading) {
    return null;
  }

  if (favoriteVendorList.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>{t("emptyTitle")}</h2>
        <p className={styles.emptyText}>{t("emptyDescription")}</p>
      </div>
    );
  }

  return (
    <ul className={styles.grid}>
      {favoriteVendorList.map((vendor, index) => (
        <li key={vendor.id} className={styles.gridItem}>
          <VendorCard
            vendor={vendor}
            href={`/vendors/${vendor.slug}`}
            favoriteAction="remove"
            priority={index === 0}
          />
        </li>
      ))}
    </ul>
  );
}
