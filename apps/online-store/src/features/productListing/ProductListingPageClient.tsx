"use client";

import ResponsiveSideMenu from "@/components/layout/ResponsiveSideMenu";
import ProductListingClient from "@/components/productPage/ProductListingClient";
import { useProductListingFilters } from "@/hooks/useProductListingFilters";
import type { Category, ProductSummary } from "@/types/api";

import styles from "./productListingPage.module.css";

type ProductListingPageClientProps = {
  products: ProductSummary[];
  title: string;
  categories: Category[];
  vendors: string[];
  maxPrice: number;
};

export default function ProductListingPageClient({
  products,
  title,
  categories,
  vendors,
  maxPrice,
}: ProductListingPageClientProps) {
  const { filters, filterMenuProps } = useProductListingFilters({
    maxPrice,
  });

  return (
    <main className={styles.page}>
      <ResponsiveSideMenu
        categories={categories}
        vendors={vendors}
        maxPrice={maxPrice}
        {...filterMenuProps}
      />
      <section className={styles.content}>
        <ProductListingClient
          products={products}
          title={title}
          categories={categories}
          vendors={vendors}
          maxPrice={maxPrice}
          filters={filters}
          filterMenuProps={filterMenuProps}
        />
      </section>
    </main>
  );
}
