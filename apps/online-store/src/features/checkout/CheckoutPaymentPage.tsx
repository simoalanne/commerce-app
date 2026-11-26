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

  const [{ cart, cartUpdatedAt, cartItems, products, paymentOptions }, termsOfSale, t] =
    await Promise.all([
      getCheckoutServerState({
        locale,
        includePaymentMethods: true,
        adjustCartToAvailability: false,
        params,
      }),
      getLegalDocumentByKey("TERMS_OF_SALE", params),
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

  if (!termsOfSale) {
    throw new Error("Checkout payment page requires terms of sale to be legally compliant");
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
          paymentOptions={paymentOptions}
          termsDocument={{
            title: termsOfSale.title,
            content: termsOfSale.content,
            updatedAt: new Date(termsOfSale.updatedAt).toISOString(),
          }}
        />
      </main>
    </>
  );
}
