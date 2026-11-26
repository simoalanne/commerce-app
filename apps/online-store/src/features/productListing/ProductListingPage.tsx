import { Suspense } from "react";

import ResponsiveSideMenu from "@/components/layout/ResponsiveSideMenu";
import { ProductListingFallback } from "@/components/productPage/ProductListingClient";
import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import { getCurrentCategory } from "@/server/storefrontContext";
import type { RouteParams } from "@/types";

import ProductListingPageClient from "./ProductListingPageClient";

import styles from "./productListingPage.module.css";

export default async function ProductListingPage({ params }: RouteParams) {
  const [t, api, currentCategory] = await Promise.all([
    getServerTranslations(params),
    createServerSideApiClient(params),
    getCurrentCategory(params).catch(() => null),
  ]);

  const [{ body: categories }, { body: products }] = await Promise.all([
    api.categories.getAll(),
    api.products.getAll({ query: { categoryId: currentCategory?.id } }),
  ]);

  const title = currentCategory?.name ?? t("header.products");

  const dynamicMaxPrice = products.length > 0 ? Math.max(...products.map((p) => p.price)) : 200;

  const uniqueVendors = Array.from(new Set(products.map((product) => product.vendorName)))
    .filter((name) => name !== undefined && name !== null)
    .sort();

  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <ResponsiveSideMenu
            categories={categories}
            vendors={uniqueVendors}
            maxPrice={dynamicMaxPrice}
          />
          <section className={styles.content}>
            <ProductListingFallback
              products={products}
              title={title}
              categories={categories}
              vendors={uniqueVendors}
              maxPrice={dynamicMaxPrice}
            />
          </section>
        </main>
      }
    >
      <ProductListingPageClient
        products={products}
        title={title}
        categories={categories}
        vendors={uniqueVendors}
        maxPrice={dynamicMaxPrice}
      />
    </Suspense>
  );
}
