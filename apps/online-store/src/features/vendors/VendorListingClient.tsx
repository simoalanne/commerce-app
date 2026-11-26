"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { OptionsPopover } from "@/components/OptionsPopover";
import VendorCard from "@/components/vendors/VendorCard";
import type { Category, VendorSummary } from "@/types/api";

import styles from "./vendorListingClient.module.css";
import dropdownStyles from "@/components/OptionsPopover.module.css";

type VendorListingClientProps = {
  vendors: VendorSummary[];
  categories?: Category[];
};

type SortValue = "default" | "name-asc" | "rating-desc" | "reviews-desc";

export default function VendorListingClient({ vendors }: VendorListingClientProps) {
  const t = useTranslations("vendorListing");
  const [sort, setSort] = useState<SortValue>("default");
  const sortOptions = [
    { value: "default", label: t("filters.sort.options.default") },
    { value: "name-asc", label: t("filters.sort.options.nameAsc") },
    { value: "rating-desc", label: t("filters.sort.options.ratingDesc") },
    { value: "reviews-desc", label: t("filters.sort.options.reviewsDesc") },
  ] satisfies { value: SortValue; label: string }[];
  const selectedSortLabel =
    sort === "default"
      ? t("filters.sort.label")
      : (sortOptions.find((option) => option.value === sort)?.label ?? t("filters.sort.label"));
  const selectedSortOption = sortOptions.find((option) => option.value === sort);

  const visibleVendors = useMemo(() => {
    if (sort === "name-asc") {
      return [...vendors].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sort === "rating-desc") {
      return [...vendors].sort((a, b) => {
        const aRating = a.avgRating ?? -1;
        const bRating = b.avgRating ?? -1;
        if (aRating === bRating) return a.name.localeCompare(b.name);
        return bRating - aRating;
      });
    }

    if (sort === "reviews-desc") {
      return [...vendors].sort((a, b) => {
        const aReviews = a.totalRatings ?? 0;
        const bReviews = b.totalRatings ?? 0;
        if (aReviews === bReviews) return a.name.localeCompare(b.name);
        return bReviews - aReviews;
      });
    }

    return vendors;
  }, [vendors, sort]);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarSummary}>
          <p>{t("resultsCount", { count: visibleVendors.length })}</p>
        </div>

        <OptionsPopover
          options={sortOptions}
          selected={selectedSortOption}
          onSelect={(option) => setSort(option.value)}
          getDisplayName={(option) => option.label}
          contentAriaLabel={t("filters.sort.label")}
          trigger={
            <button
              type="button"
              className={dropdownStyles.triggerButton}
              aria-label={t("filters.sort.label")}
            >
              {selectedSortLabel}
              <ChevronDown size={20} />
            </button>
          }
        />
      </div>

      {visibleVendors.length > 0 ? (
        <ul className={styles.grid}>
          {visibleVendors.map((vendor, index) => (
            <li key={vendor.id} className={styles.gridItem}>
              <VendorCard vendor={vendor} href={`/vendors/${vendor.slug}`} priority={index === 0} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.emptyState}>
          <h2>{t("empty.title")}</h2>
          <p>{t("empty.description")}</p>
        </div>
      )}
    </>
  );
}
