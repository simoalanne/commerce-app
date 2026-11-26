import { redirect } from "next/navigation";

import { CheckoutHeader } from "@/components/layout/CheckoutHeader";
import { getServerTranslations } from "@/i18n/serverTranslations";
import { getLegalDocumentByKey } from "@/server/getLegalDocumentByKey";
import type { RouteParams } from "@/types";

import { CheckoutPaymentPageClient } from "./CheckoutPaymentPageClient";
import { getCheckoutServerState } from "./getCheckoutServerState";

import styles from "./CheckoutPaymentPage.module.css";

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
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const isPaymentCanceled = resolvedSearchParams.paymentCanceled === "1";

  const [
    { cart, cartUpdatedAt, cartItems, products, initialDeliveryFee, paymentMethods },
    orderAndDeliveryTerms,
    t,
  ] = await Promise.all([
    getCheckoutServerState({
      locale,
      includeInitialDeliveryFee: true,
      includePaymentMethods: true,
      adjustCartToAvailability: false,
      params,
    }),
    getLegalDocumentByKey("ORDER_AND_DELIVERY_TERMS", params),
    getServerTranslations(params, "checkout.paymentPage"),
  ]);
  const hasUnexpectedSearchParams = Object.entries(resolvedSearchParams).some(
    ([key, value]) => key !== "paymentCanceled" || (value != null && value !== "1"),
  );

  if (hasUnexpectedSearchParams) {
    redirect(isPaymentCanceled ? `/${locale}/checkout?paymentCanceled=1` : `/${locale}/checkout`);
  }

  if (cartItems.length === 0) {
    redirect(`/${locale}/cart`);
  }

  if (!orderAndDeliveryTerms) {
    throw new Error(
      "Checkout payment page requires order and delivery terms to be legally compliant",
    );
  }

  return (
    <>
      <CheckoutHeader />
      <main className={styles.page}>
        <header>
          <h1 className={styles.pageTitle}>{t("title")}</h1>
        </header>
        <CheckoutPaymentPageClient
          initialCart={cart}
          initialCartUpdatedAt={cartUpdatedAt}
          initialIsPaymentCanceled={isPaymentCanceled}
          cartItems={cartItems}
          availableProducts={products}
          initialDeliveryFee={initialDeliveryFee}
          paymentMethods={paymentMethods}
          termsDocument={{
            title: orderAndDeliveryTerms.title,
            content: orderAndDeliveryTerms.content,
            updatedAt: new Date(orderAndDeliveryTerms.updatedAt).toISOString(),
          }}
        />
      </main>
    </>
  );
}
