import { RouteError, safe } from "@rest-rpc/core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import ScrollHeader from "@/app/[locale]/HeaderScrollShell";
import createServerSideApiClient from "@/server/serverApiClient";
import type { RouteParams } from "@/types";

import ReviewYourOrderPageClient from "./ReviewYourOrderPageClient";

type ReviewYourOrderPageProps = RouteParams & {
  searchParams: Promise<{
    orderId?: string;
  }>;
};

export default async function ReviewYourOrderPage({
  params,
  searchParams,
}: ReviewYourOrderPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const orderId = Number(resolvedSearchParams.orderId);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(`review-order-access-token-${orderId}`)?.value;

  if (!accessToken) {
    redirect(`/${locale}`);
  }

  const client = await createServerSideApiClient(params);
  const { error, data } = await safe(
    client.orderReviews.getByOrder({ query: { token: accessToken } }, { cache: "no-cache" }),
  );

  if (error) {
    if (error instanceof RouteError && (error.status === 400 || error.status === 404)) {
      redirect(`/${locale}`);
    }

    throw error;
  }

  const initialPage = data.body;
  const hasSubmittedReview = initialPage.reviewables.some(
    (reviewable) => reviewable.review != null,
  );

  if (hasSubmittedReview) {
    redirect(`/${locale}/account/orders`);
  }

  return (
    <>
      <ScrollHeader alwaysScrolled animated />
      <ReviewYourOrderPageClient
        initialPage={initialPage}
        orderId={orderId}
        accessToken={accessToken}
      />
    </>
  );
}
