"use client";

import { useTranslations } from "next-intl";

import type { Category } from "@/types/api";

import FilterMenu, { type FilterMenuProps } from "../layout/FilterMenu";
import SideBar from "../layout/SideBar";
import FilterDropdown from "./FilterDropdown";

import styles from "./MobileFilterPanel.module.css";

interface MobileFilterPanelProps {
  open: boolean;
  onClose: () => void;
  sort: string;
  onSortChange: (v: string) => void;
  categories?: Category[];
  vendors?: string[];
  maxPrice?: number;
  filterMenuProps?: Pick<
    FilterMenuProps,
    "filters" | "onCheckboxToggle" | "onFavoritesToggle" | "onCommitPrice" | "onClearFilters"
  >;
}

export default function MobileFilterPanel({
  open,
  onClose,
  sort,
  onSortChange,
  categories = [],
  vendors = [],
  maxPrice = 100,
  filterMenuProps,
}: MobileFilterPanelProps) {
  const t = useTranslations("productListing.filters");

  return (
    <SideBar
      side="left"
      title={t("mobile.title")}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      footer={
        <button type="button" className={styles.showProductsBtn} onClick={onClose}>
          {t("mobile.showProducts")}
        </button>
      }
    >
      <div className={styles.panelContent}>
        <div className={styles.sortSection}>
          <p className={styles.sortLabel}>{t("sort.label")}</p>
          <FilterDropdown value={sort} onChange={onSortChange} />
        </div>

        <div className={styles.divider} />

        <FilterMenu
          categories={categories}
          vendors={vendors}
          maxPrice={maxPrice}
          variant="mobile"
          onNavigate={onClose}
          {...filterMenuProps}
        />
      </div>
    </SideBar>
  );
}
