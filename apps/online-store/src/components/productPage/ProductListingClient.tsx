"use client";

import { slugify } from "@acme/shared";
import type { InferClientResponse } from "@rest-rpc/core";
import { useQuery } from "@tanstack/react-query";
import { ListFilter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SetStateAction } from "react";
import { useMemo, useState } from "react";

import type { Api } from "@/api/client";
import type { FilterMenuProps, FilterMenuState } from "@/components/layout/FilterMenu";
import { useAuth } from "@/features/auth/clerk";
import { useApiClient } from "@/providers/ApiClientProvider";
import type { Category, ProductSummary } from "@/types/api";

import ViewToggle from "../buttons/ToggleView";
import ListOfProducts from "../homePage.tsx/ListOfProducts";
import ToggledViewProductsList from "../items-lists/ToggledViewProductsList";
import FilterDropdown from "../productFilter/FilterDropdown";
import MobileFilterPanel from "../productFilter/MobileFilterPanel";

import styles from "./allProductsClient.module.css";

export type ProductListingClientProps = {
  products: ProductSummary[];
  title: string;
  categories?: Category[];
  vendors?: string[];
  maxPrice?: number;
  filters?: FilterMenuState;
  filterMenuProps?: Pick<
    FilterMenuProps,
    "filters" | "onCheckboxToggle" | "onFavoritesToggle" | "onCommitPrice" | "onClearFilters"
  >;
};

type ProductListingFilters = {
  activeCategories: string[];
  activeVendors: string[];
  activeAvailabilities: string[];
  activeMinPrice: number;
  activeMaxPrice: number;
  activeFavorites: boolean;
  favoriteProducts: InferClientResponse<Api["user"]["account"]["getFavoriteProducts"]>["body"];
};

function getDynamicMinPrice(products: ProductSummary[]) {
  if (products.length === 0) return 0;

  const minPrice = products.reduce(
    (min, product) => (product.price < min ? product.price : min),
    products[0].price,
  );

  return Math.floor(minPrice);
}

function getDynamicMaxPrice(products: ProductSummary[]) {
  if (products.length === 0) return 0;

  const maxPrice = products.reduce(
    (max, product) => (product.price > max ? product.price : max),
    products[0].price,
  );

  return Math.ceil(maxPrice);
}

function ProductListingContent({
  products,
  title,
  categories = [],
  vendors = [],
  maxPrice = 100,
  filterMenuProps,
  activeCategories,
  activeVendors,
  activeAvailabilities,
  activeMinPrice,
  activeMaxPrice,
  activeFavorites,
  favoriteProducts,
}: ProductListingClientProps & ProductListingFilters) {
  const t = useTranslations("productListing");
  const [sort, setSort] = useState<string>("default");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [animateViewChange, setAnimateViewChange] = useState(false);
  const [pendingSearch, setPendingSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const visibleProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const fullyFiltered = products.filter((product) => {
      if (normalizedQuery && !product.name.toLowerCase().includes(normalizedQuery)) return false;

      if (product.price < activeMinPrice || product.price > activeMaxPrice) return false;

      if (
        activeCategories.length > 0 &&
        !activeCategories.includes(slugify(product.category || ""))
      ) {
        return false;
      }

      if (activeVendors.length > 0) {
        if (!product.vendorName || !activeVendors.includes(slugify(product.vendorName))) {
          return false;
        }
      }

      if (activeAvailabilities.length > 0) {
        const wantsAvailable = activeAvailabilities.includes("inStock");
        const wantsSoldOut = activeAvailabilities.includes("outOfStock");

        if (wantsAvailable && !wantsSoldOut && product.isOutOfStock) return false;
        if (wantsSoldOut && !wantsAvailable && !product.isOutOfStock) return false;
      }

      return !(activeFavorites && !favoriteProducts.some((favorite) => favorite.id === product.id));
    });

    if (sort === "name-asc") {
      return [...fullyFiltered].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sort === "rating-desc") {
      return [...fullyFiltered].sort((a, b) => {
        if (a.avgRating === b.avgRating) return a.name.localeCompare(b.name);
        return b.avgRating - a.avgRating;
      });
    }
    if (sort === "price-asc") {
      return [...fullyFiltered].sort((a, b) => a.price - b.price);
    }
    if (sort === "price-desc") {
      return [...fullyFiltered].sort((a, b) => b.price - a.price);
    }
    if (sort === "category") {
      return [...fullyFiltered].sort((a, b) => {
        if ((a.category || "") === (b.category || "")) return a.name.localeCompare(b.name);
        return (a.category || "").localeCompare(b.category || "");
      });
    }

    return fullyFiltered;
  }, [
    products,
    searchQuery,
    sort,
    activeCategories,
    activeVendors,
    activeAvailabilities,
    activeMinPrice,
    activeMaxPrice,
    activeFavorites,
    favoriteProducts,
  ]);

  const handleViewChange = (nextView: SetStateAction<"grid" | "list">) => {
    setAnimateViewChange(true);
    setView(nextView);
  };

  return (
    <>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.mobileFilterContainer}>
            <button
              type="button"
              className={styles.mobileFilterBtn}
              onClick={() => setMobileOpen(true)}
              aria-label={t("filters.open")}
            >
              <ListFilter size={18} />
              <span>{t("filters.open") || "Rajaa"}</span>
            </button>
            <p>{t("resultsCount", { count: visibleProducts.length })}</p>
          </div>

          <div className={styles.filterButtons}>
            <FilterDropdown onChange={setSort} value={sort} />
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.searchBar}>
            <Search className={styles.searchIcon} aria-hidden="true" />

            <input
              type="text"
              value={pendingSearch}
              onChange={(event) => setPendingSearch(event.target.value)}
              placeholder={t("search.placeholder")}
              className={styles.searchInput}
              aria-label={t("search.ariaLabel")}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSearchQuery(pendingSearch.trim());
                }
              }}
            />

            <div className={styles.searchActions}>
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => {
                  setPendingSearch("");
                  setSearchQuery("");
                }}
                aria-label={t("search.clearAriaLabel")}
                disabled={pendingSearch.length === 0 && searchQuery.length === 0}
              >
                <X aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.searchButton}
                onClick={() => setSearchQuery(pendingSearch.trim())}
                aria-label={t("search.buttonAriaLabel")}
              >
                {t("search.button")}
              </button>
            </div>
          </div>

          <div className={styles.toggleContainer}>
            <ViewToggle view={view} setView={handleViewChange} />
          </div>
        </div>
      </div>

      <div
        className={`${styles.viewContent} ${animateViewChange ? styles.viewContentAnimated : ""}`}
        key={view}
      >
        {view === "grid" ? (
          <ListOfProducts
            products={visibleProducts}
            layout="grid"
            cardVariant="detailed"
            headingLevel="h2"
          />
        ) : (
          <ToggledViewProductsList products={visibleProducts} headingLevel="h2" />
        )}
      </div>

      <MobileFilterPanel
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sort={sort}
        onSortChange={setSort}
        categories={categories}
        vendors={vendors}
        maxPrice={maxPrice}
        filterMenuProps={filterMenuProps}
      />
    </>
  );
}

export function ProductListingFallback(props: ProductListingClientProps) {
  return (
    <ProductListingContent
      {...props}
      activeCategories={[]}
      activeVendors={[]}
      activeAvailabilities={[]}
      activeMinPrice={getDynamicMinPrice(props.products)}
      activeMaxPrice={getDynamicMaxPrice(props.products)}
      activeFavorites={false}
      favoriteProducts={[]}
    />
  );
}

export default function ProductListingClient(props: ProductListingClientProps) {
  const { isSignedIn } = useAuth();
  const { queryUtils } = useApiClient();
  const { data: favoriteProducts = [] } = useQuery(
    queryUtils.user.account.getFavoriteProducts.queryOptions({
      select: (r) => r.body,
      enabled: !!isSignedIn,
    }),
  );

  const dynamicMinPrice = useMemo(() => getDynamicMinPrice(props.products), [props.products]);
  const dynamicMaxPrice = useMemo(() => getDynamicMaxPrice(props.products), [props.products]);
  const filters = props.filters ?? {
    activeCategories: [],
    activeVendors: [],
    activeAvailabilities: [],
    activeFavorites: false,
    localMinPrice: dynamicMinPrice,
    localMaxPrice: dynamicMaxPrice,
  };

  return (
    <ProductListingContent
      {...props}
      activeCategories={filters.activeCategories}
      activeVendors={filters.activeVendors}
      activeAvailabilities={filters.activeAvailabilities}
      activeMinPrice={filters.localMinPrice}
      activeMaxPrice={filters.localMaxPrice}
      activeFavorites={filters.activeFavorites}
      favoriteProducts={favoriteProducts}
    />
  );
}
