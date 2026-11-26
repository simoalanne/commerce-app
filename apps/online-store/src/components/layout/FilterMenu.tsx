"use client";

import { slugify } from "@acme/shared";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/clerk";
import type { Category } from "@/types/api";

import styles from "./FilterMenu.module.css";

export type FilterParamKey = "category" | "vendor" | "saatavuus";

export type FilterMenuState = {
  activeCategories: string[];
  activeVendors: string[];
  activeAvailabilities: string[];
  activeFavorites: boolean;
  localMinPrice: number;
  localMaxPrice: number;
};

export interface FilterMenuProps {
  categories?: Category[];
  vendors?: string[];
  maxPrice?: number;
  onNavigate?: () => void;
  variant?: "sidebar" | "rail" | "mobile";
  filters?: FilterMenuState;
  onCheckboxToggle?: (paramKey: FilterParamKey, value: string) => void;
  onFavoritesToggle?: (checked: boolean) => void;
  onCommitPrice?: (minPrice: number, maxPrice: number) => void;
  onClearFilters?: () => void;
}

type FilterMenuContentProps = FilterMenuProps & {
  activeCategories: string[];
  activeVendors: string[];
  activeAvailabilities: string[];
  activeFavorites: boolean;
  localMinPrice: number;
  localMaxPrice: number;
};

const FilterSection = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={styles.filterSection}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {title}
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && <div className={styles.sectionContent}>{children}</div>}
    </div>
  );
};

function FilterMenuContent({
  categories = [],
  vendors = [],
  maxPrice = 100,
  variant = "sidebar",
  activeCategories,
  activeVendors,
  activeAvailabilities,
  activeFavorites,
  localMinPrice,
  localMaxPrice,
  onCheckboxToggle,
  onFavoritesToggle,
  onCommitPrice,
  onClearFilters,
}: FilterMenuContentProps) {
  const t = useTranslations("sideMenu"); // Using same translation keys
  const { isSignedIn } = useAuth();
  const [draftMinPrice, setDraftMinPrice] = useState(localMinPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(localMaxPrice);

  const containerClass =
    variant === "rail"
      ? `${styles.sideMenuContainer} ${styles.sideMenuRail}`
      : variant === "mobile"
        ? `${styles.sideMenuContainer} ${styles.sideMenuMobile}`
        : styles.sideMenuContainer;

  const availabilities = [
    { label: t("status.inStock"), value: "inStock" },
    { label: t("status.outOfStock"), value: "outOfStock" },
  ];

  const ABSOLUTE_MIN = 1;
  const ABSOLUTE_MAX = Math.max(Math.ceil(maxPrice), ABSOLUTE_MIN + 1);

  useEffect(() => {
    setDraftMinPrice(localMinPrice);
    setDraftMaxPrice(localMaxPrice);
  }, [localMinPrice, localMaxPrice]);

  const commitPrice = () => {
    onCommitPrice?.(draftMinPrice, draftMaxPrice);
  };

  const fillLeft = `${((draftMinPrice - ABSOLUTE_MIN) / (ABSOLUTE_MAX - ABSOLUTE_MIN)) * 100}%`;
  const fillWidth = `${((draftMaxPrice - draftMinPrice) / (ABSOLUTE_MAX - ABSOLUTE_MIN)) * 100}%`;

  return (
    <div className={containerClass}>
      <h2 className={styles.mainTitle}>{t("title")}</h2>

      {isSignedIn && (
        <FilterSection title={t("favorites")}>
          <ul className={styles.checkboxList}>
            <li>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={activeFavorites}
                  onChange={(e) => onFavoritesToggle?.(e.target.checked)}
                />
                <span className={styles.favoritesLabelSpan}>{t("favoritesOnly")}</span>
              </label>
            </li>
          </ul>
        </FilterSection>
      )}

      <FilterSection title={t("categories")}>
        <ul className={styles.checkboxList}>
          {categories?.map((c) => {
            const value = slugify(c.name);

            return (
              <li key={c.id}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={activeCategories.includes(value)}
                    onChange={() => onCheckboxToggle?.("category", value)}
                  />
                  <span>{c.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </FilterSection>

      {vendors.length > 0 && (
        <FilterSection title={t("vendors")}>
          <ul className={styles.checkboxList}>
            {vendors.map((vendor) => {
              const value = slugify(vendor);

              return (
                <li key={vendor}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={activeVendors.includes(value)}
                      onChange={() => onCheckboxToggle?.("vendor", value)}
                    />
                    <span>{vendor}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </FilterSection>
      )}

      <FilterSection title={t("price")}>
        <div className={styles.priceRangeContainer}>
          <div className={styles.priceLabels}>
            {draftMinPrice}€ - {draftMaxPrice}€
          </div>
          <div className={styles.sliderWrapper}>
            <div className={styles.sliderTrack}></div>
            <div className={styles.sliderFill} style={{ left: fillLeft, width: fillWidth }}></div>

            <input
              type="range"
              min={ABSOLUTE_MIN}
              max={ABSOLUTE_MAX}
              value={draftMinPrice}
              onChange={(e) => {
                const val = Math.min(Number(e.target.value), draftMaxPrice - 1);
                setDraftMinPrice(val);
              }}
              onPointerUp={commitPrice}
              onBlur={commitPrice}
              className={styles.rangeInput}
              aria-label={`${t("price")} min`}
            />
            <input
              type="range"
              min={ABSOLUTE_MIN}
              max={ABSOLUTE_MAX}
              value={draftMaxPrice}
              onChange={(e) => {
                const val = Math.max(Number(e.target.value), draftMinPrice + 1);
                setDraftMaxPrice(val);
              }}
              onPointerUp={commitPrice}
              onBlur={commitPrice}
              className={styles.rangeInput}
              aria-label={`${t("price")} max`}
            />
          </div>
        </div>
      </FilterSection>

      <FilterSection title={t("availability")}>
        <ul className={styles.checkboxList}>
          {availabilities.map((status) => (
            <li key={status.value}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={activeAvailabilities.includes(status.value)}
                  onChange={() => onCheckboxToggle?.("saatavuus", status.value)}
                />
                <span>{status.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </FilterSection>

      <button type="button" className={styles.clearFiltersBtn} onClick={onClearFilters}>
        {t("clear")}
      </button>
    </div>
  );
}

function FilterMenuFallback(props: FilterMenuProps) {
  const ABSOLUTE_MIN = 1;
  const ABSOLUTE_MAX = Math.max(Math.ceil(props.maxPrice ?? 100), ABSOLUTE_MIN + 1);

  return (
    <FilterMenuContent
      {...props}
      activeCategories={[]}
      activeVendors={[]}
      activeAvailabilities={[]}
      activeFavorites={false}
      localMinPrice={ABSOLUTE_MIN}
      localMaxPrice={ABSOLUTE_MAX}
    />
  );
}

function ControlledFilterMenu(props: FilterMenuProps & { filters: FilterMenuState }) {
  return (
    <FilterMenuContent
      {...props}
      activeCategories={props.filters.activeCategories}
      activeVendors={props.filters.activeVendors}
      activeAvailabilities={props.filters.activeAvailabilities}
      activeFavorites={props.filters.activeFavorites}
      localMinPrice={props.filters.localMinPrice}
      localMaxPrice={props.filters.localMaxPrice}
    />
  );
}

export default function FilterMenu(props: FilterMenuProps) {
  if (props.filters) {
    return <ControlledFilterMenu {...props} filters={props.filters} />;
  }

  return <FilterMenuFallback {...props} />;
}
