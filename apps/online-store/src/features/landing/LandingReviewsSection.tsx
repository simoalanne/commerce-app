import createServerSideApiClient from "@/server/serverApiClient";
import type { RouteParams } from "@/types";

import type { ReviewsResponse } from "./LandingReviewsSectionClient";
import LandingReviewsSectionClient from "./LandingReviewsSectionClient";

const withCommentsOnly = (reviews: ReviewsResponse["reviews"]) =>
  reviews.filter((review) => review.comment);

export default async function LandingReviewsSection({ params }: RouteParams) {
  const client = await createServerSideApiClient(params);
  const response = (await client.reviews.list()).body;
  const reviews = withCommentsOnly(response.reviews);

  if (reviews.length === 0) {
    return null;
  }

  return <LandingReviewsSectionClient summary={response.summary} reviews={reviews} />;
}
