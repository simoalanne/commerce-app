"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type {
  FilterMenuProps,
  FilterMenuState,
  FilterParamKey,
} from "@/components/layout/FilterMenu";
import { usePathname } from "@/i18n/navigation";

const ABSOLUTE_MIN = 1;

export function getProductListingMaxPriceBound(maxPrice: number) {
  return Math.max(Math.ceil(maxPrice), ABSOLUTE_MIN + 1);
}

function getPriceParam(searchParams: URLSearchParams, key: string) {
  const value = Number(searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function getParamValues(searchParams: URLSearchParams, key: string) {
  return searchParams.getAll(key);
}

function getInitialFilters(searchParams: URLSearchParams, maxPrice: number): FilterMenuState {
  const absoluteMax = getProductListingMaxPriceBound(maxPrice);

  return {
    activeCategories: getParamValues(searchParams, "category"),
    activeVendors: getParamValues(searchParams, "vendor"),
    activeAvailabilities: getParamValues(searchParams, "saatavuus"),
    activeFavorites: searchParams.get("favorites") === "true",
    localMinPrice: getPriceParam(searchParams, "minHinta") ?? ABSOLUTE_MIN,
    localMaxPrice: getPriceParam(searchParams, "maxHinta") ?? absoluteMax,
  };
}

function valuesMatch(a: string[], b: string[]) {
  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
}

function filtersMatch(a: FilterMenuState, b: FilterMenuState) {
  return (
    valuesMatch(a.activeCategories, b.activeCategories) &&
    valuesMatch(a.activeVendors, b.activeVendors) &&
    valuesMatch(a.activeAvailabilities, b.activeAvailabilities) &&
    a.activeFavorites === b.activeFavorites &&
    a.localMinPrice === b.localMinPrice &&
    a.localMaxPrice === b.localMaxPrice
  );
}

function serializeFilters(filters: FilterMenuState, maxPrice: number) {
  const params = new URLSearchParams();
  const defaultMaxPrice = getProductListingMaxPriceBound(maxPrice);

  for (const category of filters.activeCategories) {
    params.append("category", category);
  }
  for (const vendor of filters.activeVendors) {
    params.append("vendor", vendor);
  }
  for (const availability of filters.activeAvailabilities) {
    params.append("saatavuus", availability);
  }
  if (filters.activeFavorites) {
    params.set("favorites", "true");
  }
  if (filters.localMinPrice !== ABSOLUTE_MIN) {
    params.set("minHinta", filters.localMinPrice.toString());
  }
  if (filters.localMaxPrice !== defaultMaxPrice) {
    params.set("maxHinta", filters.localMaxPrice.toString());
  }

  return params.toString();
}

function updateArrayValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

export function useProductListingFilters({ maxPrice }: { maxPrice: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => getInitialFilters(searchParams, maxPrice));
  const filtersRef = useRef(filters);

  const replaceUrl = (nextFilters: FilterMenuState) => {
    const nextSearch = serializeFilters(nextFilters, maxPrice);
    window.history.replaceState(null, "", nextSearch ? `${pathname}?${nextSearch}` : pathname);
  };

  const applyFilters = (nextFilters: FilterMenuState) => {
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    replaceUrl(nextFilters);
  };

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    const nextFilters = getInitialFilters(searchParams, maxPrice);

    setFilters((current) => {
      if (filtersMatch(current, nextFilters)) {
        return current;
      }

      filtersRef.current = nextFilters;
      return nextFilters;
    });
  }, [searchParams, maxPrice]);

  const handleCheckboxToggle = (paramKey: FilterParamKey, value: string) => {
    const current = filtersRef.current;
    const nextFilters = {
      ...current,
      activeCategories:
        paramKey === "category"
          ? updateArrayValue(current.activeCategories, value)
          : current.activeCategories,
      activeVendors:
        paramKey === "vendor"
          ? updateArrayValue(current.activeVendors, value)
          : current.activeVendors,
      activeAvailabilities:
        paramKey === "saatavuus"
          ? updateArrayValue(current.activeAvailabilities, value)
          : current.activeAvailabilities,
    };

    applyFilters(nextFilters);
  };

  const handleFavoritesToggle = (checked: boolean) => {
    applyFilters({ ...filtersRef.current, activeFavorites: checked });
  };

  const handleCommitPrice = (minPrice: number, nextMaxPrice: number) => {
    applyFilters({
      ...filtersRef.current,
      localMinPrice: minPrice,
      localMaxPrice: nextMaxPrice,
    });
  };

  const handleClearFilters = () => {
    const nextFilters: FilterMenuState = {
      activeCategories: [],
      activeVendors: [],
      activeAvailabilities: [],
      activeFavorites: false,
      localMinPrice: ABSOLUTE_MIN,
      localMaxPrice: getProductListingMaxPriceBound(maxPrice),
    };

    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    window.history.replaceState(null, "", pathname);
  };

  const filterMenuProps: Pick<
    FilterMenuProps,
    "filters" | "onCheckboxToggle" | "onFavoritesToggle" | "onCommitPrice" | "onClearFilters"
  > = {
    filters,
    onCheckboxToggle: handleCheckboxToggle,
    onFavoritesToggle: handleFavoritesToggle,
    onCommitPrice: handleCommitPrice,
    onClearFilters: handleClearFilters,
  };

  return {
    filters,
    filterMenuProps,
  };
}
