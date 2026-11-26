import { Check } from "lucide-react";
import Image from "next/image";

import { Link } from "@/i18n/navigation";

import RatingSummary from "./RatingSummary";

import styles from "./ReviewCard.module.css";

type ReviewCardProps = {
  rating: number;
  comment: string | null;
  imageUrl: string | null;
  customerName: string | null;
  fallbackCustomerName: string;
  targetLabel: string;
  targetHref?: string;
};

export default function ReviewCard({
  rating,
  comment,
  imageUrl,
  customerName,
  fallbackCustomerName,
  targetLabel,
  targetHref,
}: ReviewCardProps) {
  return (
    <article className={`${styles.card} ${imageUrl ? "" : styles.cardNoImage}`}>
      {imageUrl && (
        <div className={styles.imageWrapper}>
          <Image
            src={imageUrl}
            alt="Card thumbnail"
            fill
            className={styles.image}
            sizes="(max-width: 640px) 256px, 225px"
            priority={false}
            quality={60}
          />
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.commentWrapper}>
          {comment ? (
            <p className={`${styles.comment} ${imageUrl ? "" : styles.commentNoImage}`}>
              {comment}
            </p>
          ) : null}
        </div>

        <div className={styles.meta}>
          <RatingSummary rating={rating} variant="starsOnly" />

          <div className={styles.customerRow}>
            <p className={styles.customerName}>{customerName ?? fallbackCustomerName}</p>
            <span className={styles.verifiedBadge} aria-hidden="true">
              <Check size={10} strokeWidth={3} />
            </span>
          </div>

          {targetHref ? (
            <Link
              prefetch={false}
              href={targetHref}
              className={styles.targetLink}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {targetLabel}
            </Link>
          ) : (
            <span className={styles.targetText}>{targetLabel}</span>
          )}
        </div>
      </div>
    </article>
  );
}
