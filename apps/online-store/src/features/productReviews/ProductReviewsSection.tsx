"use client";

import type { InferClientResponse } from "@rest-rpc/core";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Api } from "@/api/client";
import Carousel from "@/components/carousel/Carousel";
import ReviewCard from "@/components/reviews/ReviewCard";
import ReviewDetailsModal from "@/components/reviews/ReviewDetailsModal";
import { getValidLocale } from "@/i18n/routing";

import styles from "./ProductReviewsSection.module.css";

type ProductReviews = InferClientResponse<Api["reviews"]["getByProduct"]>["body"];
type ProductReview = InferClientResponse<Api["reviews"]["getByProduct"]>["body"]["items"][number];

type ProductReviewsSectionProps = {
  id?: string;
  locale: string;
  title: string;
  anonymousReviewerLabel: string;
  reviews: ProductReviews["items"];
};

export default function ProductReviewsSection({
  id,
  locale,
  title,
  anonymousReviewerLabel,
  reviews,
}: ProductReviewsSectionProps) {
  const t = useTranslations();
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeLocale = getValidLocale(locale);

  const dateFormatter = new Intl.DateTimeFormat(activeLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (reviews.length === 0) {
    return null;
  }

  return (
    <>
      <section id={id} className={styles.section}>
        <h2 className={styles.title}>{title}</h2>

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
              aria-label={t("landingPage.reviews.openReview", {
                name: review.reviewer.displayName ?? t("landingPage.reviews.anonymous"),
              })}
            >
              <ReviewCard
                rating={review.rating}
                comment={review.comment}
                imageUrl={null}
                customerName={review.reviewer.displayName}
                fallbackCustomerName={anonymousReviewerLabel}
                targetLabel={dateFormatter.format(new Date(review.createdAt))}
              />
            </button>
          )}
        />
      </section>

      <ReviewDetailsModal
        open={isModalOpen}
        onOpenChange={(open) => setIsModalOpen(open)}
        rating={selectedReview?.rating ?? 0}
        reviewerName={selectedReview?.reviewer.displayName ?? null}
        fallbackReviewerName={anonymousReviewerLabel}
        isVerified={true}
        createdAt={selectedReview?.createdAt ?? new Date()}
        comment={selectedReview?.comment ?? null}
      />
    </>
  );
}
