"use client";

import type { InferClientResponse } from "@rest-rpc/core";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Api } from "@/api/client";
import Carousel from "@/components/carousel/Carousel";
import RatingStars from "@/components/reviews/RatingStars";
import ReviewCard from "@/components/reviews/ReviewCard";
import ReviewDetailsModal from "@/components/reviews/ReviewDetailsModal";

import styles from "./VendorReviewsSection.module.css";

type VendorReviewsSectionProps = {
  vendorName: string;
  vendorImageUrl: string | null;
  avgRating: number;
  totalRatings: number;
  reviews: InferClientResponse<Api["vendors"]["getReviews"]>["body"];
};

export default function VendorReviewsSection({
  vendorName,
  vendorImageUrl,
  avgRating,
  totalRatings,
  reviews,
}: VendorReviewsSectionProps) {
  type VendorReview = InferClientResponse<Api["vendors"]["getReviews"]>["body"][number];

  const [selectedReview, setSelectedReview] = useState<VendorReview | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const t = useTranslations();

  if (reviews.length === 0) {
    return null;
  }

  return (
    <section id="vendor-reviews" aria-labelledby="vendor-reviews-title" className={styles.section}>
      <div className={styles.header}>
        <h2 id="vendor-reviews-title" className={styles.title}>
          {t("vendorReviews.title")}
        </h2>

        <div className={styles.summaryRow}>
          <div className={styles.ratingBlock}>
            <RatingStars rating={avgRating} className={styles.stars} />
            <span>
              {avgRating.toFixed(2)} ★ ({totalRatings})
            </span>
            <span className={styles.verifiedBadge}>{t("landingPage.reviews.verified")}</span>
          </div>
        </div>
      </div>

      <div className={styles.carouselWrap}>
        <Carousel
          items={reviews}
          getItemKey={(review) => review.id}
          renderItem={(review) => (
            <button
              type="button"
              className={styles.reviewCardButton}
              onClick={() => {
                setSelectedReview(review);
                setIsModalOpen(true);
              }}
            >
              <ReviewCard
                rating={review.rating}
                comment={review.comment}
                imageUrl={vendorImageUrl}
                customerName={review.reviewer.displayName}
                fallbackCustomerName={t("vendorReviews.anonymous")}
                targetLabel={vendorName}
              />
            </button>
          )}
        />

        <ReviewDetailsModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          imageUrl={vendorImageUrl}
          imageAlt={vendorName}
          rating={selectedReview?.rating ?? 0}
          reviewerName={selectedReview?.reviewer.displayName ?? null}
          fallbackReviewerName={t("vendorReviews.anonymous")}
          isVerified={true}
          createdAt={selectedReview?.createdAt ?? new Date()}
          comment={selectedReview?.comment ?? null}
          targetLabel={vendorName}
          targetHref={undefined}
        />
      </div>
    </section>
  );
}
