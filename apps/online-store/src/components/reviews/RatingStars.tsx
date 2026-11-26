import { Star } from "lucide-react";

import styles from "./RatingStars.module.css";

type RatingStarsProps = {
  rating: number;
  size?: number;
  className?: string;
};

export default function RatingStars({ rating, size = 16, className }: RatingStarsProps) {
  const rootClassName = className ? `${styles.stars} ${className}` : styles.stars;

  return (
    <span className={rootClassName} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((position) => {
        const fill = Math.min(1, Math.max(0, rating - (position - 1)));

        return (
          <span key={`star-${position}`} className={styles.starWrapper}>
            <Star size={size} fill="none" strokeWidth={1.8} className={styles.starEmpty} />
            <span className={styles.starFillOverlay} style={{ width: `${fill * 100}%` }}>
              <Star
                size={size}
                fill="currentColor"
                strokeWidth={1.8}
                className={styles.starFilled}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}
