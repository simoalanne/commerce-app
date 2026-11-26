import { ChevronsRight } from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

import FavoriteVendorButton from "@/components/favorites/FavoriteVendorButton";
import SideBar from "@/components/layout/SideBar";
import RatingSummary from "@/components/reviews/RatingSummary";
import {
  VendorProductListingFallback,
  VendorProductListingSection,
} from "@/features/vendors/VendorProductListingSection";
import VendorReviewsSection from "@/features/vendors/VendorReviewsSection";
import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import { getCurrentVendor } from "@/server/storefrontContext";
import type { RouteParams } from "@/types";

import styles from "./vendor.module.css";

export { generateVendorDetailsMetadata as generateMetadata } from "@/metadata/storefrontMetadata";

export function generateStaticParams() {
  return [];
}

export default async function VendorPage({ params }: RouteParams) {
  const api = await createServerSideApiClient(params);
  const vendor = await getCurrentVendor(params);
  const { body: products } = await api.products.getAll({
    query: { vendorId: vendor.id },
  });
  const { body: categories } = await api.categories.getAll();
  const relevantCategories = categories.filter((category) =>
    products.some((product) => product.category === category.name),
  );
  const t = await getServerTranslations(params);

  // The price filter works in whole euros.
  const dynamicMaxPrice =
    products.length > 0 ? Math.ceil(Math.max(...products.map((p) => p.priceCents)) / 100) : 200;

  const uniqueVendors = Array.from(new Set(products.map((p) => p.vendorName))).sort();
  const productsTitle = t("header.products");

  const divider = <div style={{ marginTop: 20 }} />;

  const { body: vendorReviews } = await api.vendors.getReviews({
    params: { id: vendor.id },
  });

  const vendorReviewsWithComment = vendorReviews.filter((vendorReview) => vendorReview.comment);

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <div className={`heroImageFrame ${styles.vendorHeader}`}>
          {vendor.imageUrl ? (
            <Image
              src={vendor.imageUrl}
              alt={vendor.name}
              fill
              priority
              fetchPriority="high"
              quality={60}
              className={styles.heroImage}
              sizes="100vw"
            />
          ) : null}

          <div className={`heroImageOverlayContent ${styles.vendorHeaderText}`}>
            {vendor.tags.length > 0 && (
              <div className={styles.tagsWrapper}>
                <p className={styles.tagStyle}>{vendor.tags[0]}</p>
              </div>
            )}

            <h1 className={styles.vendorTitle}>{vendor.name}</h1>
            <p className={styles.vendorSlogan}>{vendor.slogan}</p>

            {vendor.avgRating != null && vendor.totalRatings != null ? (
              <div className={styles.vendorRating}>
                <RatingSummary rating={vendor.avgRating} count={vendor.totalRatings} />
              </div>
            ) : null}

            <SideBar
              side="left"
              trigger={
                <span className={styles.vendorStoryTrigger}>
                  {t("vendorPage.readStory")} <ChevronsRight />
                </span>
              }
              triggerLabel="Open vendor story"
              title="Vendor story"
            >
              <div className={`${styles.vendorStory} quotes`}>
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>{vendor.story}</ReactMarkdown>
              </div>
            </SideBar>

            <FavoriteVendorButton
              vendorId={String(vendor.id)}
              vendorName={vendor.name}
              variant="inline"
              className={styles.favoriteButton}
            />
          </div>
        </div>

        {divider}

        <Suspense
          fallback={
            <VendorProductListingFallback
              products={products}
              title={productsTitle}
              categories={relevantCategories}
              vendors={uniqueVendors}
              maxPrice={dynamicMaxPrice}
            >
              {vendor.avgRating != null &&
              vendor.totalRatings != null &&
              vendorReviews.length > 0 ? (
                <VendorReviewsSection
                  vendorName={vendor.name}
                  vendorImageUrl={vendor.imageUrl}
                  avgRating={vendor.avgRating}
                  totalRatings={vendor.totalRatings}
                  reviews={vendorReviews}
                />
              ) : null}
            </VendorProductListingFallback>
          }
        >
          <VendorProductListingSection
            products={products}
            title={productsTitle}
            categories={relevantCategories}
            vendors={uniqueVendors}
            maxPrice={dynamicMaxPrice}
          >
            {vendor.avgRating != null &&
            vendor.totalRatings != null &&
            vendorReviewsWithComment.length > 0 ? (
              <VendorReviewsSection
                vendorName={vendor.name}
                vendorImageUrl={vendor.imageUrl}
                avgRating={vendor.avgRating}
                totalRatings={vendor.totalRatings}
                reviews={vendorReviewsWithComment}
              />
            ) : null}
          </VendorProductListingSection>
        </Suspense>
      </section>
    </main>
  );
}
