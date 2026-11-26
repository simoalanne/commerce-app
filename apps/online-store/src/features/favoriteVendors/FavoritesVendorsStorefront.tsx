"use client";

import type { ReactNode } from "react";

import Carousel from "@/components/carousel/Carousel";
import VendorCard from "@/components/vendors/VendorCard";
import { Link } from "@/i18n/navigation";
import type { VendorSummary } from "@/types/api";

import { useFavoriteVendorsList } from "./useFavoriteVendorsList";

import styles from "./FavoritesVendorsStorefront.module.css";

type FavoriteVendorsSectionProps = {
  title: string;
  linkHref: string;
  linkLabel: string;
  linkIcon?: ReactNode;
  vendors: VendorSummary[];
};

export default function FavoriteVendorsSection({
  title,
  linkHref,
  linkLabel,
  linkIcon,
  vendors,
}: FavoriteVendorsSectionProps) {
  const { isLoaded, isSignedIn, isLoading, favoriteVendorList } = useFavoriteVendorsList(vendors);

  if (!isLoaded || !isSignedIn || isLoading) {
    return null;
  }

  if (favoriteVendorList.length === 0) {
    return null;
  }

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <Link href={linkHref} className={styles.seeDirectory} prefetch={false}>
          {linkLabel} {linkIcon}
        </Link>
      </div>
      <Carousel
        items={favoriteVendorList}
        getItemKey={(vendor) => vendor.id}
        renderItem={(vendor) => (
          <div className={styles.carouselItem}>
            <VendorCard vendor={vendor} href={`/vendors/${vendor.slug}`} favoriteAction="remove" />
          </div>
        )}
      />
    </section>
  );
}
