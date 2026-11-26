import CheckoutPaymentPageContent from "@/features/checkout/CheckoutPaymentPage";

export { generatePaymentMetadata as generateMetadata } from "@/metadata/noIndexMetadata";

import type { RouteParams } from "@/types";

type CheckoutPaymentPageProps = RouteParams & {
  searchParams: Promise<{
    paymentCanceled?: string;
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function CheckoutPaymentPage({
  params,
  searchParams,
}: CheckoutPaymentPageProps) {
  return <CheckoutPaymentPageContent params={params} searchParams={searchParams} />;
}
