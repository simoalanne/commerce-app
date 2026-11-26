"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import type { ProductSummary } from "@/types/api";
import { readableTextColor } from "@/utils/tagColor";

import styles from "./ProductImageCarousel.module.css";

interface ProductImageCarouselProps {
  product: ProductSummary;
  images: string[];
  altText: string;
}

export default function ProductImageCarousel({
  product,
  images,
  altText,
}: ProductImageCarouselProps) {
  const t = useTranslations("productPage.imageCarousel");
  const [currentIndex, setCurrentIndex] = useState(0);

  const goPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className={styles.carouselWrapper}>
      <div className={styles.mainImageContainer}>
        {product.isOutOfStock ? (
          <div className={styles.outOfStockTagOverlay}>{t("outOfStock")}</div>
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
          src={images[currentIndex]}
          alt={`${altText} ${currentIndex + 1}`}
          fill
          priority={true}
          fetchPriority="high"
          quality={60}
          className={styles.mainImage}
          sizes="(max-width: 768px) 80vw, 100vw"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.navButton} ${styles.prevButton}`}
              onClick={goPrevious}
              aria-label={t("previousImage")}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={goNext}
              aria-label={t("nextImage")}
            >
              <ChevronRight size={24} />
            </button>

            <div className={styles.thumbnailContainerOverlay}>
              {images.map((img, idx) => (
                <button
                  type="button"
                  key={img}
                  className={`${styles.thumbnailButton} ${
                    currentIndex === idx ? styles.activeThumbnail : ""
                  }`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={t("goToImage", { index: idx + 1 })}
                >
                  <Image
                    src={img}
                    alt="thumbnail"
                    width={50}
                    height={50}
                    loading="lazy"
                    className={styles.thumbnailImage}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
