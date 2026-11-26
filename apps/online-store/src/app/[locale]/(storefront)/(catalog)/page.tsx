import { ArrowRight } from "lucide-react";

import CategoriesSection from "@/components/items-lists/CategoriesSection";
import ProductsSection from "@/components/items-lists/ProductsSection";
import FavoriteProductsSection from "@/features/favoriteProducts/FavoritesProductsStorefront";
import FavoriteVendorsSection from "@/features/favoriteVendors/FavoritesVendorsStorefront";
import LandingReviewsSection from "@/features/landing/LandingReviewsSection";
import { Link } from "@/i18n/navigation";
import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import type { RouteParams } from "@/types";

import styles from "./marketplace.module.css";

export { generateLandingPageMetadata as generateMetadata } from "@/metadata/storefrontMetadata";

export default async function HomePage({ params }: RouteParams) {
  const [api, tMarket, tFavorites, tFavoriteVendors, t] = await Promise.all([
    createServerSideApiClient(params),
    getServerTranslations(params, "marketplacePage"),
    getServerTranslations(params, "productListing.favoritesPage"),
    getServerTranslations(params, "vendorListing.favoritesPage"),
    getServerTranslations(params),
  ]);

  const [{ body: vendors }, { body: products }, { body: categories }] = await Promise.all([
    api.vendors.getAll(),
    api.products.getAll(),
    api.categories.getAll(),
  ]);

  const featuredProducts = products.filter((p) => p.isFeatured).slice(0, 8);

  return (
    <main className={styles.page}>
      {/* --- Hero Section --- */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} aria-hidden="true" />
        <h1 dangerouslySetInnerHTML={{ __html: tMarket("heroTitle") }} />
        <p>{tMarket("heroDescription")}</p>
        <div className={styles.heroActions}>
          <Link href="/products" className={styles.btnPrimary}>
            {tMarket("startShopping")}
          </Link>
          <Link href="/vendors" className={styles.btnSecondary}>
            {tMarket("vendorStories")}
          </Link>
        </div>
      </section>
      <section className={styles.content}>
        <FavoriteProductsSection
          title={tFavorites("title")}
          layout="carousel"
          linkHref="/products?favorites=true"
          linkLabel={tMarket("seeAll")}
          linkIcon={<ArrowRight size={20} />}
          products={products}
        />
        <FavoriteVendorsSection
          title={tFavoriteVendors("title")}
          linkHref="/vendors"
          linkLabel={tMarket("seeAll")}
          linkIcon={<ArrowRight size={20} />}
          vendors={vendors}
        />
        {/* --- Featured Products --- */}
        <ProductsSection
          title={tMarket("featuredProducts")}
          linkHref="/products"
          linkLabel={tMarket("seeAll")}
          linkIcon={<ArrowRight size={20} />}
          products={featuredProducts}
          layout="carousel"
          cardVariant="detailed"
        />

        {/* --- Categories --- */}
        <CategoriesSection
          title={t("header.categories")}
          linkHref="/products"
          linkLabel={tMarket("seeAll")}
          linkIcon={<ArrowRight size={20} />}
          categories={categories}
          layout="carousel"
        />

        {/* --- Reviews --- */}
        <LandingReviewsSection params={params} />
      </section>
    </main>
  );
}
