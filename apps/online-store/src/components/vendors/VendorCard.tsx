import Image from "next/image";

import FavoriteVendorButton from "@/components/favorites/FavoriteVendorButton";
import RatingSummary from "@/components/reviews/RatingSummary";
import { Link } from "@/i18n/navigation";
import type { VendorSummary } from "@/types/api";

import styles from "./VendorCard.module.css";

type VendorCardProps = {
  vendor: VendorSummary;
  href: string;
  variant?: "default" | "compact";
  favoriteAction?: "toggle" | "remove";
  priority?: boolean;
};

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function VendorCard({
  vendor,
  href,
  variant = "default",
  favoriteAction = "toggle",
  priority = false,
}: VendorCardProps) {
  const visibleTags = vendor.tags.slice(0, variant === "compact" ? 3 : 4);

  return (
    <article className={joinClassNames(styles.card, variant === "compact" && styles.compact)}>
      <FavoriteVendorButton
        vendorId={String(vendor.id)}
        vendorName={vendor.name}
        mode={favoriteAction}
        variant="overlay"
      />
      <Link href={href} className={styles.cardLink} prefetch={false}>
        {vendor.imageUrl ? (
          <div className={styles.imageWrapper}>
            <Image
              src={vendor.imageUrl}
              alt={vendor.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              quality={60}
              priority={priority}
              fetchPriority={priority ? "high" : undefined}
              className={styles.cardImage}
            />
          </div>
        ) : (
          <div className={styles.cardImageFallback} aria-hidden="true" />
        )}

        <div className={styles.cardContent}>
          <div className={styles.cardHeading}>
            <h2 className={styles.cardTitle}>{vendor.name}</h2>
            {vendor.avgRating != null && vendor.totalRatings != null && (
              <RatingSummary rating={vendor.avgRating} count={vendor.totalRatings} />
            )}
          </div>
          <div className={styles.tagList}>
            {visibleTags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}
