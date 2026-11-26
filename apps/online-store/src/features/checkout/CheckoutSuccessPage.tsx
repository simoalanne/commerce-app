import { formatShippingAddressLines } from "@acme/shared/schemas/shippingAddress";
import { RouteError, safe } from "@rest-rpc/core";
import { ArrowRight, CheckCircle2, Clock3, MapPinHouse, ReceiptText } from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { getServerTranslations } from "@/i18n/serverTranslations";
import createServerSideApiClient from "@/server/serverApiClient";
import type { DestructuredRouteParams, RouteParams } from "@/types";
import { formatCents } from "@/utils/formatPrice";

import CheckoutSuccessClientSync from "./CheckoutSuccessClientSync";

import styles from "./CheckoutSuccessPage.module.css";

type CheckoutSuccessPageProps = RouteParams & {
  searchParams: Promise<{
    orderId?: string;
  }>;
};

async function loadCheckoutSuccessState(token: string, params: DestructuredRouteParams) {
  const { locale } = await params;
  const client = await createServerSideApiClient(params);
  const { error: pollError, data: pollResponse } = await safe(
    client.checkout.pollOrderStatus(
      { query: { token } },
      // no cache here is reasonable because we shouldnt really cache userspecific order status.
      // If we want to cache this, its better idea to do it on backend side than nextjs side.
      { cache: "no-store" },
    ),
  );

  if (pollError) {
    if (pollError instanceof RouteError && (pollError.status === 400 || pollError.status === 404)) {
      redirect(`/${locale}`);
    }
    throw pollError;
  }

  const pollData = pollResponse.body;

  if (!pollData.isPaid) {
    return {
      state: "pending" as const,
      pollData,
    };
  }

  const { error: orderError, data: orderResponse } = await safe(
    client.orders.getGuestById({ query: { token } }, { cache: "no-store" }),
  );

  if (orderError) {
    if (
      orderError instanceof RouteError &&
      (orderError.status === 400 || orderError.status === 404)
    ) {
      redirect(`/${locale}`);
    }
    throw orderError;
  }

  return {
    state: "confirmed" as const,
    pollData,
    orderDetails: orderResponse.body,
  };
}

const getSearchParamsOrRedirect = async (
  searchParamsPromise: Promise<{ orderId?: string }>,
  locale: string,
) => {
  const searchParams = await searchParamsPromise;
  const orderId = Number(searchParams.orderId);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(`checkout-success-access-token-${orderId}`)?.value;

  if (accessToken && Object.keys(searchParams).length > 1) {
    redirect(`/${locale}/checkout/success?orderId=${orderId}`);
  }

  if (!accessToken) {
    redirect(`/${locale}`);
  }

  return { orderId, token: accessToken };
};

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: CheckoutSuccessPageProps) {
  const { locale } = await params;
  const t = await getServerTranslations(params, "checkout.success");
  const { orderId, token } = await getSearchParamsOrRedirect(searchParams, locale);
  const successState = await loadCheckoutSuccessState(token, params);
  const isConfirmed = successState.pollData.isPaid;

  const heroTitle = isConfirmed ? t("confirmedTitle") : t("pendingTitle");
  const heroBody = isConfirmed ? t("confirmedBody", { orderId }) : t("pendingBody", { orderId });

  if (successState.state === "pending") {
    return (
      <main className={styles.page}>
        <CheckoutSuccessClientSync accessToken={token} shouldPoll />
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={[styles.statusIcon, styles.statusIconPending].join(" ")}>
              <Clock3 size={52} strokeWidth={2.2} />
            </div>
            <h1 className={styles.heroTitle}>{heroTitle}</h1>
            <p className={styles.heroBody}>{heroBody}</p>
            <div className={styles.heroActions}>
              <Link href="/" className={styles.primaryButton}>
                {t("continueShopping")}
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
        <div className={styles.content}>
          <div className={`${styles.statusBanner} ${styles.statusBannerPending}`}>
            <Clock3 size={20} />
            <p>{t("pendingBanner")}</p>
          </div>
        </div>
      </main>
    );
  }

  const { pricing } = successState.orderDetails;

  return (
    <main className={styles.page}>
      <CheckoutSuccessClientSync shouldPoll={false} />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div
            className={[
              styles.statusIcon,
              isConfirmed ? styles.statusIconConfirmed : styles.statusIconPending,
            ].join(" ")}
          >
            {isConfirmed ? (
              <CheckCircle2 size={52} strokeWidth={2.2} />
            ) : (
              <Clock3 size={52} strokeWidth={2.2} />
            )}
          </div>
          <h1 className={styles.heroTitle}>{heroTitle}</h1>
          <p className={styles.heroBody}>{heroBody}</p>
          <div className={styles.heroActions}>
            <Link href="/" className={styles.primaryButton}>
              {t("continueShopping")}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <ReceiptText size={24} strokeWidth={2} className={styles.cardHeaderIcon} />
              <h2 className={styles.cardTitle}>{t("orderSummaryTitle")}</h2>
            </div>

            <div className={styles.itemList}>
              {successState.orderDetails.orderDetails.items.map((item) => (
                <article key={item.sku} className={styles.itemRow}>
                  {item.imageUrl ? (
                    <div className={styles.itemImageWrapper}>
                      <Image
                        className={styles.itemImage}
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="5rem"
                      />
                    </div>
                  ) : (
                    <div className={styles.itemImageFallback}>{item.name.slice(0, 1)}</div>
                  )}
                  <div>
                    <h3 className={styles.itemName}>{item.name}</h3>
                    <p className={styles.itemMeta}>{t("quantity", { quantity: item.quantity })}</p>
                  </div>

                  <p className={styles.itemPrice}>
                    {formatCents(item.unitPriceCents * item.quantity)}
                  </p>
                </article>
              ))}
            </div>

            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>{t("itemsSubtotal")}</span>
                <span>{formatCents(pricing.itemsSubtotalCents)}</span>
              </div>
              {pricing.itemsDiscountCents !== null ? (
                <div className={styles.totalRow}>
                  <span>{t("itemDiscount")}</span>
                  <span>-{formatCents(pricing.itemsDiscountCents)}</span>
                </div>
              ) : null}
              <div className={styles.totalRowStrong}>
                <span>{t("total")}</span>
                <span>{formatCents(pricing.chargedTotalCents)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>{t("includedVat", { rate: pricing.vatRate })}</span>
                <span>{formatCents(pricing.includedVatCents)}</span>
              </div>
            </div>
          </section>

          <div className={styles.sideColumn}>
            <section className={styles.infoCard}>
              <MapPinHouse size={24} strokeWidth={2} className={styles.infoIcon} />
              <h2 className={styles.infoTitle}>{t("deliveryAddress")}</h2>
              {formatShippingAddressLines(
                successState.orderDetails.orderDetails.shippingAddress,
              ).map((line) => (
                <p key={line} className={styles.infoBody}>
                  {line}
                </p>
              ))}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
