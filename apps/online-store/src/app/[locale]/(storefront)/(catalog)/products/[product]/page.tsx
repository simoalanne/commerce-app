import { slugify } from "@acme/shared";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

import Collapsible from "@/components/collapsible/Collapsible";
import FavoriteProductButton from "@/components/favorites/FavoriteProductButton";
import ListOfProducts from "@/components/homePage.tsx/ListOfProducts";
import ProductAddToCartButton from "@/components/productPage/ProductAddToCartButton";
import ProductBreadcrumb from "@/components/productPage/ProductBreadcrumb";
import ProductDescription from "@/components/productPage/ProductDescription";
import ProductImageCarousel from "@/components/productPage/ProductImageCarousel";
import ProductPriceAndStock from "@/components/productPage/ProductPriceAndStock";
import ProductReviewsSection from "@/features/productReviews/ProductReviewsSection";
import ProductReviewSummaryLink from "@/features/productReviews/ProductReviewSummaryLink";
import { Link } from "@/i18n/navigation";
import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import {
  getCurrentProduct,
  getCurrentProductSummary,
  getStorefrontContext,
} from "@/server/storefrontContext";
import type { RouteParams } from "@/types";

import styles from "./productPage.module.css";

export { generateProductDetailsMetadata as generateMetadata } from "@/metadata/storefrontMetadata";

export function generateStaticParams() {
  return [];
}

export default async function ProductPage({ params }: RouteParams) {
  const reviewsSectionId = "customer-reviews";
  const { locale } = await params;

  const storefrontContext = await getStorefrontContext(params);
  const productSummary = await getCurrentProductSummary(params);
  const product = await getCurrentProduct(params);
  const api = await createServerSideApiClient(params);
  const paymentMethods = await api.checkout
    .getPaymentMethods()
    .then((r) => r.body)
    .catch(() => []);

  const vendor = storefrontContext.vendors.find((p) => p.id === productSummary.vendorId);
  const categoryId = productSummary.categoryId;

  const sameCategoryProducts = categoryId
    ? await api.products
        .getAll({ query: { categoryId } })
        .then((r) => r.body.filter((p) => p.id !== product.id))
    : [];

  const productReviews =
    product.reviewCount > 0
      ? (
          await api.reviews.getByProduct({
            params: { productId: product.id },
          })
        ).body
      : null;

  const productReviewsWithComment = productReviews?.items.filter(
    (productReview) => productReview.comment,
  );

  const tProductPage = await getServerTranslations(params, "productPage");
  const tMarket = await getServerTranslations(params, "marketplacePage");

  const reviewSummary = productReviews?.summary ?? {
    avgRating: product.avgRating,
    reviewCount: product.reviewCount,
  };

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

  // JSON-LD structured data describing the product for SEO.
  // Assumes following:
  // - Vendor name can be considered a brand
  // - Product is always owned by a vendor, so vendor name is always available.
  // - All product images are relevant and should be included in the structured data
  // - The store is the seller, selling on behalf of the vendor.
  // - Products are always sold new.
  // - Products are always sold in EUR.
  // - Reviews are only included if there is at least one review, because that's the recommendation.
  // - There is no priceValidUntil date because price doesn't change based on time.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [...new Set([product.imageUrl, ...product.imageUrls])],
    description: product.fullDescription,
    sku: product.sku,
    brand: {
      "@type": "Brand",
      name: vendor?.name ?? "",
    },
    ...(reviewSummary?.reviewCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviewSummary.avgRating,
        reviewCount: reviewSummary.reviewCount,
      },
    }),
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      url: `/${SITE_URL}/${locale}/products/${product.slug}`,
      price: product.price,
      availability: product.isOutOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "Acme",
      },
    },
  };

  const vendorListItem = {
    "@type": "ListItem",
    position: 1,
    name: vendor?.name ?? "",
    item: `${SITE_URL}/${locale}/vendors/${vendor?.slug}`,
  };

  const productListItem = {
    "@type": "ListItem",
    position: 2,
    name: product.name,
    item: `${SITE_URL}/${locale}/products/${product.slug}`,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [vendorListItem, productListItem],
  };

  return (
    <main className={styles.productPageContainer}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replaceAll("<", "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replaceAll("<", "\\u003c"),
        }}
      />
      <ProductBreadcrumb
        storefrontContext={storefrontContext}
        params={params}
        productId={product.id}
        productName={product.name}
      />
      <section key={product.sku} className={styles.productInfoGrid}>
        <div className={styles.productImageWrapper}>
          <ProductImageCarousel
            product={product}
            images={Array.from(new Set([product.imageUrl, ...(product.imageUrls || [])]))}
            altText={product.name}
          />
        </div>

        <div className={styles.productDetailsGrid}>
          <div className={styles.gridItem}>
            <p className={styles.vendorName}>{vendor?.name ?? ""}</p>
            <div className={styles.productText}>
              <h3>{product.name}</h3>
              <ProductDescription fullDescription={product.fullDescription} />

              {reviewSummary.reviewCount > 0 ? (
                <ProductReviewSummaryLink
                  rating={reviewSummary.avgRating}
                  count={reviewSummary.reviewCount}
                  targetId={reviewsSectionId}
                />
              ) : null}

              <ProductPriceAndStock
                initialPrice={product.price}
                initialStock={product.availableStock}
                initialPurchaseLimitPerOrder={product.purchaseLimitPerOrder}
                initialPricePerKg={product.pricePerKg}
                styles={styles}
              />
            </div>
            <div className={styles.addToCartArea}>
              <ProductAddToCartButton
                product={product}
                className={styles.cartBtn}
                flyToCart={!product.isOutOfStock}
                imgUrl={product.imageUrl}
              />
              <FavoriteProductButton
                productId={product.id}
                productName={product.name}
                variant="inline"
                className={styles.favoriteActionButton}
              />
            </div>
            {paymentMethods.length > 0 ? (
              <div className={styles.paymentMethods}>
                <div className={styles.paymentMethodsRow}>
                  {paymentMethods.map((method, index) => (
                    <div key={`${method.id}-${index}`} className={styles.paymentMethodLogoWrap}>
                      <Image
                        src={method.imageUrl}
                        alt={method.name}
                        fill
                        className={styles.paymentMethodLogo}
                        sizes="64px"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <Collapsible title={tProductPage("deliveryInfoTitle")}>
              <div className={styles.collapsibleDesc}>
                <p>{tProductPage("deliveryInfoIntro")}</p>
                <ul>
                  <li>{tProductPage("deliveryInfoStep1")}</li>
                  <li>{tProductPage("deliveryInfoStep2")}</li>
                </ul>
              </div>
            </Collapsible>
          </div>
        </div>
      </section>

      {sameCategoryProducts.length > 0 && product.category && (
        <section className={styles.productByCategorySection}>
          <div className={styles.otherProductsSectionHeader}>
            <p className={styles.otherCategoriesTitle}>{tProductPage("otherProducts")}</p>
            <Link
              href={`/products/?category=${slugify(product.category)}`}
              className={styles.seeDirectory}
            >
              {tMarket("seeAll")} <ArrowRight size={20} />
            </Link>
          </div>
          <div className={styles.productCarouselWrapper}>
            <ListOfProducts
              products={sameCategoryProducts.slice(0, 5)}
              layout="carousel"
              cardVariant="detailed"
              headingLevel="p"
            />
          </div>
        </section>
      )}

      {productReviewsWithComment && productReviewsWithComment.length > 0 ? (
        <ProductReviewsSection
          id={reviewsSectionId}
          locale={locale}
          title={tProductPage("reviewsTitle")}
          anonymousReviewerLabel={tProductPage("anonymousReviewer")}
          reviews={productReviewsWithComment}
        />
      ) : null}
    </main>
  );
}
