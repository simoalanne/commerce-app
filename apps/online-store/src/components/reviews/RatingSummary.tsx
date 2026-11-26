"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "./RatingSummary.module.css";

type RatingSummaryProps = {
  rating: number;
  count?: number;
  onClick?: () => void;
  variant?: "default" | "starsOnly";
};

export default function RatingSummary({
  rating,
  count,
  onClick,
  variant = "default",
}: RatingSummaryProps) {
  const t = useTranslations("landingPage.reviews");
  const Component = onClick ? "button" : "div";
  const showCount = variant === "default";
  const hasCount = typeof count === "number";
  const starSize = variant === "starsOnly" ? 24 : 16;

  const formattedRating = rating.toFixed(1);
  const labelText =
    showCount && hasCount
      ? t("ariaLabelWithCount", { rating: formattedRating, count })
      : t("ariaLabelStarsOnly", { rating: formattedRating });

  return (
    <Component
      {...(onClick ? { type: "button" as const, onClick } : { role: "img" })}
      className={`${styles.root} ${onClick ? styles.rootInteractive : ""} ${variant === "starsOnly" ? styles.rootStarsOnly : ""}`.trim()}
      aria-label={labelText}
    >
      <span className={styles.stars} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((position) => {
          const fill = Math.min(1, Math.max(0, rating - (position - 1)));
          return (
            <span key={`star-${position}`} className={styles.starWrapper}>
              {/* Empty star underneath */}
              <Star size={starSize} className={styles.starInactive} fill="none" strokeWidth={1.8} />
              {/* Filled star clipped from left */}
              <span className={styles.starFillOverlay} style={{ width: `${fill * 100}%` }}>
                <Star
                  size={starSize}
                  className={styles.starActive}
                  fill="currentColor"
                  strokeWidth={1.8}
                />
              </span>
            </span>
          );
        })}
      </span>
      {showCount && hasCount ? <span className={styles.count}>({count})</span> : null}
    </Component>
  );
}
