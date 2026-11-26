"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { Modal, ModalCloseButton } from "@/components/Modal";
import { Link } from "@/i18n/navigation";

import RatingStars from "./RatingStars";

import styles from "./ReviewDetailsModal.module.css";

const getRelativeTime = (dateInput: Date | string, locale: string) => {
  const date = new Date(dateInput);
  const now = new Date();
  let duration = (date.getTime() - now.getTime()) / 1000;

  const divisions = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 30, unit: "day" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "long",
      }).format(Math.round(duration), division.unit);
    }

    duration /= division.amount;
  }

  return "";
};

type ReviewDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string | null;
  imageAlt?: string;
  rating: number;
  reviewerName: string | null;
  fallbackReviewerName: string;
  isVerified: boolean;
  createdAt: Date | string;
  comment: string | null;
  targetLabel?: string;
  targetHref?: string;
};

export default function ReviewDetailsModal({
  open,
  onOpenChange,
  imageUrl,
  imageAlt,
  rating,
  reviewerName,
  fallbackReviewerName,
  isVerified,
  createdAt,
  comment,
  targetLabel,
  targetHref,
}: ReviewDetailsModalProps) {
  const locale = useLocale();
  const t = useTranslations();
  const createdAtLabel = getRelativeTime(createdAt, locale);
  const displayReviewerName = reviewerName ?? fallbackReviewerName;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={displayReviewerName}
      hideHeader
      contentClassName={`${styles.modal} ${imageUrl ? "" : styles.modalSingleColumn}`}
    >
      <ModalCloseButton className={styles.modalClose} onClick={() => onOpenChange(false)} />
      {imageUrl &&
        (targetHref ? (
          <Link
            href={targetHref}
            className={styles.modalMedia}
            prefetch={false}
            aria-label={targetLabel}
          >
            <Image
              src={imageUrl}
              alt={imageAlt ?? `${displayReviewerName} review photo`}
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              className={styles.modalImage}
            />
          </Link>
        ) : (
          <div className={styles.modalMedia}>
            <Image
              src={imageUrl}
              alt={imageAlt ?? `${displayReviewerName} review photo`}
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              className={styles.modalImage}
            />
          </div>
        ))}

      <div className={styles.modalContent}>
        <RatingStars rating={rating} size={28} className={styles.modalStars} />

        <div className={styles.modalReviewerRow}>
          <div className={styles.modalAvatar}>{displayReviewerName[0]}</div>

          <div>
            <div className={styles.modalReviewerName}>
              {displayReviewerName}
              {isVerified ? (
                <span className={styles.verifiedBadge}>{t("landingPage.reviews.verified")}</span>
              ) : null}
            </div>

            <div className={styles.modalMeta}>
              <span>{createdAtLabel}</span>
            </div>
          </div>
        </div>

        <p className={styles.modalComment}>{comment}</p>

        {targetLabel ? (
          targetHref ? (
            <Link
              href={targetHref}
              className={`${styles.modalTarget} ${styles.modalTargetLink}`}
              prefetch={false}
            >
              {targetLabel}
            </Link>
          ) : (
            <div className={styles.modalTarget}>{targetLabel}</div>
          )
        ) : null}
      </div>
    </Modal>
  );
}
