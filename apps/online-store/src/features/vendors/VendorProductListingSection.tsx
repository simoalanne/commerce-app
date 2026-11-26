"use client";

import type { ReactNode } from "react";

import ResponsiveSideMenu from "@/components/layout/ResponsiveSideMenu";
import ProductListingClient, {
  ProductListingFallback,
} from "@/components/productPage/ProductListingClient";
import { useProductListingFilters } from "@/hooks/useProductListingFilters";
import type { Category, ProductSummary } from "@/types/api";

import styles from "./VendorProductListingSection.module.css";

type VendorProductListingSectionProps = {
  products: ProductSummary[];
  title: string;
  categories: Category[];
  vendors: string[];
  maxPrice: number;
  children?: ReactNode;
};

export function VendorProductListingFallback({
  products,
  title,
  categories,
  vendors,
  maxPrice,
  children,
}: VendorProductListingSectionProps) {
  return (
    <section className={styles.productsSection}>
      <div className={styles.productsLayout}>
        <ResponsiveSideMenu categories={categories} maxPrice={maxPrice} />

        <div className={styles.productsListing}>
          <ProductListingFallback
            products={products}
            title={title}
            categories={categories}
            vendors={vendors}
            maxPrice={maxPrice}
          />
          {children}
        </div>
      </div>
    </section>
  );
}

export function VendorProductListingSection({
  products,
  title,
  categories,
  vendors,
  maxPrice,
  children,
}: VendorProductListingSectionProps) {
  const { filters, filterMenuProps } = useProductListingFilters({
    maxPrice,
  });

  return (
    <section className={styles.productsSection}>
      <div className={styles.productsLayout}>
        <ResponsiveSideMenu categories={categories} maxPrice={maxPrice} {...filterMenuProps} />

        <div className={styles.productsListing}>
          <ProductListingClient
            products={products}
            title={title}
            categories={categories}
            vendors={vendors}
            maxPrice={maxPrice}
            filters={filters}
            filterMenuProps={filterMenuProps}
          />
          {children}
        </div>
      </div>
    </section>
  );
}
