"use client";

import type { InferClientResponse } from "@rest-rpc/core";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import type { Api } from "@/api/client";
import Carousel from "@/components/carousel/Carousel";
import ReviewCard from "@/components/reviews/ReviewCard";
import ReviewDetailsModal from "@/components/reviews/ReviewDetailsModal";
import type { ProductSummary } from "@/types/api";

import styles from "./LandingReviewsSectionClient.module.css";

export type ReviewsResponse = InferClientResponse<Api["reviews"]["list"]>["body"];

type ReviewItem = ReviewsResponse["reviews"][number] & {
  product?: ProductSummary | null;
};

type LandingReviewsSectionClientProps = {
  summary: ReviewsResponse["summary"];
  reviews: ReviewItem[];
};

const renderStars = (rating: number, size = 16) =>
  [1, 2, 3, 4, 5].map((position) => {
    const fill = Math.min(1, Math.max(0, rating - (position - 1))); // 0 to 1
    return (
      <span key={`star-${position}`} style={{ position: "relative", display: "inline-block" }}>
        <Star size={size} fill="none" strokeWidth={1.8} className={styles.starEmpty} />
        <span
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            width: `${fill * 100}%`,
          }}
        >
          <Star size={size} fill="currentColor" strokeWidth={1.8} className={styles.starFilled} />
        </span>
      </span>
    );
  });

const getDisplayImageUrl = (review: ReviewItem): string | null => {
  if (review.imageUrl) return review.imageUrl;
  return review.productImageUrl ?? null;
};

export default function LandingReviewsSectionClient({
  summary,
  reviews,
}: LandingReviewsSectionClientProps) {
  const t = useTranslations();
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const prioritizedReviews = useMemo(() => {
    // Filter out reviews for inactive products so they don't show in the carousel.
    // To show them again (with disabled links), just remove the `.filter(r => r.isProductActive)` call.
    const activeReviews = reviews.filter((r) => r.isProductActive);

    const weightedReviews = activeReviews.map((review) => {
      const hasCustomerImage = Boolean(review.imageUrl);
      const hasProductImage = Boolean(review.productImageUrl);

      return {
        review,
        hasCustomerImage,
        hasProductImage,
        randomWeight: isMounted ? Math.random() : 0,
      };
    });

    weightedReviews.sort((a, b) => {
      if (a.hasCustomerImage && !b.hasCustomerImage) return -1;
      if (!a.hasCustomerImage && b.hasCustomerImage) return 1;
      if (a.hasProductImage && !b.hasProductImage) return -1;
      if (!a.hasProductImage && b.hasProductImage) return 1;
      return a.randomWeight - b.randomWeight;
    });

    const seenNames = new Set<string>();
    const uniqueReviews = [];

    for (const item of weightedReviews) {
      const name = item.review.customerName;
      if (name) {
        if (seenNames.has(name)) continue;
        seenNames.add(name);
      }
      uniqueReviews.push(item.review);
    }

    return uniqueReviews;
  }, [reviews, isMounted]);

  return (
    <>
      <section
        id="landing-reviews"
        aria-labelledby="landing-reviews-title"
        className={styles.section}
      >
        <div className={styles.header}>
          <h2 id="landing-reviews-title" className={styles.title}>
            {t("landingPage.reviews.title")}
          </h2>

          <div className={styles.summaryRow}>
            <div className={styles.ratingBlock}>
              <span className={styles.stars}>{renderStars(summary.avgRating)}</span>
              <span>
                {t("landingPage.reviews.summary", {
                  avgRating: summary.avgRating.toFixed(2),
                  count: summary.reviewCount,
                })}
              </span>

              <span className={styles.verifiedBadge}>{t("landingPage.reviews.verified")}</span>
            </div>
          </div>
        </div>

        <Carousel
          items={prioritizedReviews}
          getItemKey={(review) => review.id}
          centerItemsWhenStatic
          renderItem={(review) => (
            <button
              type="button"
              className={styles.reviewCardButton}
              onClick={() => {
                setSelectedReview(review);
                setIsModalOpen(true);
              }}
              aria-label={t("landingPage.reviews.openReview", {
                name: review.customerName ?? t("landingPage.reviews.anonymous"),
              })}
            >
              <ReviewCard
                rating={review.rating}
                comment={review.comment}
                imageUrl={getDisplayImageUrl(review)}
                customerName={review.customerName}
                fallbackCustomerName={t("landingPage.reviews.anonymous")}
                targetLabel={review.productName}
                targetHref={`/products/${review.productSlug}`}
              />
            </button>
          )}
        />
      </section>

      <ReviewDetailsModal
        open={isModalOpen}
        onOpenChange={(open) => setIsModalOpen(open)}
        imageUrl={selectedReview ? getDisplayImageUrl(selectedReview) : null}
        imageAlt={selectedReview?.comment || "Review image"}
        rating={selectedReview?.rating ?? 0}
        reviewerName={selectedReview?.customerName ?? null}
        fallbackReviewerName={t("landingPage.reviews.anonymous")}
        isVerified={true}
        createdAt={selectedReview?.createdAt ?? new Date()}
        comment={selectedReview?.comment ?? null}
        targetLabel={selectedReview?.productName ?? ""}
        targetHref={
          selectedReview?.isProductActive ? `/products/${selectedReview.productSlug}` : undefined
        }
      />
    </>
  );
}
