"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import FavoriteProductButton from "@/components/favorites/FavoriteProductButton";
import RatingSummary from "@/components/reviews/RatingSummary";
import { getProductMaxOrderQuantity } from "@/features/checkout/cartState";
import { useCart } from "@/hooks/useCart";
import { Link } from "@/i18n/navigation";
import type { ProductSummary } from "@/types/api";
import { formatPrice, formatPricePerKg } from "@/utils/formatPrice";
import { readableTextColor } from "@/utils/tagColor";

import AddToCartBtn from "../productPage/AddToCartBtn";

import styles from "./ListOfProducts.module.css";

type ProductListLayout = "grid" | "carousel";
type ProductCardVariant = "detailed" | "minimal";

type ProductCardProps = {
  product: ProductSummary;
  vendorName?: string;
  layout: ProductListLayout;
  cardVariant: ProductCardVariant;
  favoriteAction: "toggle" | "remove";
  isPriority: boolean;
  headingLevel?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div";
};

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function ProductCard({
  product,
  vendorName,
  layout,
  cardVariant,
  favoriteAction,
  isPriority,
  headingLevel = "h3",
}: ProductCardProps) {
  const HeadingTag = headingLevel;
  const t = useTranslations("productListing");
  const { items } = useCart();

  return (
    <article
      className={joinClassNames(
        styles.card,
        layout === "carousel" && styles.carouselCard,
        cardVariant === "detailed" ? styles.cardDetailed : styles.cardMinimal,
      )}
    >
      <FavoriteProductButton
        productId={product.id}
        productName={product.name}
        mode={favoriteAction}
        variant="overlay"
      />
      <div className={styles.mediaShell}>
        <Link href={`/products/${product.slug}`} className={styles.cardMediaLink} prefetch={false}>
          <div className={styles.imgWrapper}>
            {product.isOutOfStock ? (
              <div className={styles.outOfStockTagOverlay}>{t("product.outOfStock")}</div>
            ) : product.tags.length > 0 ? (
              <div className={styles.tagOverlayGroup}>
                {product.tags.map((tag) => (
                  <div
                    key={tag.name}
                    className={styles.tagOverlay}
                    style={{
                      backgroundColor: tag.color,
                      color: readableTextColor(tag.color),
                    }}
                  >
                    {tag.name}
                  </div>
                ))}
              </div>
            ) : null}
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              priority={isPriority}
              fetchPriority={isPriority ? "high" : undefined}
              quality={55}
              className={
                product.isOutOfStock ? styles.productOutOfStockOverlay : styles.productImage
              }
              sizes={
                layout === "carousel"
                  ? "(max-width: 768px) 50vw, 280px"
                  : "(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1200px) 25vw, 300px"
              }
            />
          </div>
        </Link>
        <div className={styles.actionsRow}>
          <AddToCartBtn
            product={product}
            className={styles.cartBtn}
            flyToCart={true}
            imgUrl={product.imageUrl}
            disabled={
              product.isOutOfStock ||
              (items[product.sku]?.quantity ?? 0) >= getProductMaxOrderQuantity(product)
            }
          >
            <span className={styles.cartBtnInner}>
              <Plus size={18} aria-hidden="true" />
            </span>
          </AddToCartBtn>
        </div>
      </div>
      <Link prefetch={false} href={`/products/${product.slug}`} className={styles.cardLink}>
        <div className={styles.productCardInfobox}>
          <HeadingTag className={styles.productName}>{product.name}</HeadingTag>
          <p className={styles.vendorName}>{vendorName}</p>
          {product.reviewCount > 0 && (
            <RatingSummary rating={product.avgRating} count={product.reviewCount} />
          )}
          <div className={styles.productMetaRow}>
            <div className={styles.priceBlock}>
              <p className={styles.price}>{formatPrice(product.price)}</p>
              {product.pricePerKg && (
                <p className={styles.pricePerKg}>{formatPricePerKg(product.pricePerKg)}</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
