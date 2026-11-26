"use client";

import RatingSummary from "@/components/reviews/RatingSummary";

type ProductReviewSummaryLinkProps = {
  rating: number;
  count: number;
  targetId: string;
};

// Required wrapper component to use RatingSummary on server component. This is because
// we cannot make the server component add the onClick behaviour because it accesses
// the DOM element which is not available on the server.
export default function ProductReviewSummaryLink({
  rating,
  count,
  targetId,
}: ProductReviewSummaryLinkProps) {
  return (
    <RatingSummary
      rating={rating}
      count={count}
      onClick={() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }}
    />
  );
}
