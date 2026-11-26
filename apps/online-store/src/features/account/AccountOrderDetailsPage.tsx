"use client";

import { downloadBlob, getContentDispositionFilename } from "@acme/shared";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { use, useState } from "react";

import { AsyncBoundary } from "@/components/async-boundary";
import { Link, useRouter } from "@/i18n/navigation";
import { getValidLocale } from "@/i18n/routing";
import { useApiClient } from "@/providers/ApiClientProvider";
import { formatCents } from "@/utils/formatPrice";

import styles from "./AccountOrderDetailsPage.module.css";
import actionStyles from "./OrderListItem.module.css";

type AccountOrderDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type AccountOrderDetailsContentProps = {
  orderId: number;
};

function formatDate(date: Date, locale: string) {
  const activeLocale = getValidLocale(locale);

  return new Intl.DateTimeFormat(activeLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

type AccountOrderStatusLabelKey = "statusAwaitingShipment" | "statusShipped";

function formatStatus(status: string, getLabel: (key: AccountOrderStatusLabelKey) => string) {
  switch (status) {
    case "PAID":
      return getLabel("statusAwaitingShipment");
    case "SHIPPED":
      return getLabel("statusShipped");
    default:
      return status;
  }
}

function formatItemName(name: unknown, defaultName: string) {
  return typeof name === "string" && name.trim().length > 0 ? name : defaultName;
}

function PricingRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={styles.infoGroup}>
      <p className={styles.infoLabel}>{label}</p>
      <p className={styles.infoValue} style={strong ? { fontWeight: 700 } : undefined}>
        {value}
      </p>
    </div>
  );
}

export default function AccountOrderDetailsPage({ params }: AccountOrderDetailsPageProps) {
  const { id } = use(params);

  return (
    <AsyncBoundary>
      <AccountOrderDetailsContent orderId={Number(id)} />
    </AsyncBoundary>
  );
}

function AccountOrderDetailsContent({ orderId }: AccountOrderDetailsContentProps) {
  const { queryUtils } = useApiClient();
  const locale = useLocale();
  const tPricing = useTranslations("checkout.success");
  const t = useTranslations("accountOrderDetails");
  const router = useRouter();
  const reviewAccessToken = useMutation(queryUtils.orders.createAccessToken.mutationOptions());
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [downloadingRefundReceiptId, setDownloadingRefundReceiptId] = useState<number | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const { data: orderResponse } = useSuspenseQuery(
    queryUtils.orders.getById.queryOptions({
      request: { params: { orderId } },
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }),
  );
  const data = orderResponse.body;

  const { orderDetails } = data;
  const instructions = orderDetails.delivery.instructions;
  const { pricing } = data;

  const handleReviewOrder = async () => {
    const result = await reviewAccessToken.mutateAsync({
      body: {
        orderId: data.id,
        scope: "order:review",
      },
    });
    router.push(
      `/review-order/access-token?orderId=${data.id}&token=${encodeURIComponent(result.body.accessToken)}&format=jwt`,
    );
  };

  const handleDownloadInvoice = async () => {
    setInvoiceError(null);
    setIsDownloadingInvoice(true);

    try {
      const invoice = await queryUtils.orders.downloadInvoice.fetch({
        params: { orderId: data.id },
      });
      downloadBlob(
        invoice.body,
        getContentDispositionFilename(invoice.headers["content-disposition"]) ??
          `invoice-${data.id}.pdf`,
      );
    } catch {
      setInvoiceError(t("invoiceDownloadError"));
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleDownloadRefundReceipt = async (
    refundReceipt: (typeof data.refundReceipts)[number],
  ) => {
    setInvoiceError(null);
    setDownloadingRefundReceiptId(refundReceipt.refundId);

    try {
      const file = await queryUtils.orders.downloadRefundReceipt.fetch({
        params: { orderId: data.id, refundId: refundReceipt.refundId },
      });
      downloadBlob(
        file.body,
        getContentDispositionFilename(file.headers["content-disposition"]) ??
          `refund-receipt-${refundReceipt.number}.pdf`,
      );
    } catch {
      setInvoiceError(t("refundReceiptDownloadError"));
    } finally {
      setDownloadingRefundReceiptId(null);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/account/orders" className={styles.backLink} prefetch={false}>
            {t("backToOrders")}
          </Link>
          <h2 className={styles.title}>{t("orderTitle", { id: data.id })}</h2>
          <p className={styles.subtitle}>
            {t("placed", {
              date: formatDate(new Date(data.createdAt), locale),
            })}{" "}
            • {formatStatus(data.status, t)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={actionStyles.reorderButton}
            onClick={() => void handleDownloadInvoice()}
            disabled={isDownloadingInvoice}
          >
            {isDownloadingInvoice ? t("invoiceDownloading") : t("downloadInvoice")}
          </button>
          {data.refundReceipts.map((refundReceipt) => (
            <button
              type="button"
              key={refundReceipt.refundId}
              className={actionStyles.reorderButton}
              onClick={() => void handleDownloadRefundReceipt(refundReceipt)}
              disabled={downloadingRefundReceiptId === refundReceipt.refundId}
            >
              {downloadingRefundReceiptId === refundReceipt.refundId
                ? t("refundReceiptDownloading")
                : t("downloadRefundReceipt", {
                    number: refundReceipt.number,
                  })}
            </button>
          ))}
          {data.status === "SHIPPED" && !data.hasSubmittedReview ? (
            <button
              type="button"
              className={actionStyles.reorderButton}
              onClick={() => void handleReviewOrder()}
              disabled={reviewAccessToken.isPending}
            >
              {t("reviewOrder")}
            </button>
          ) : null}

          <div className={styles.totalChip}>{formatCents(pricing.chargedTotalCents)}</div>
          {invoiceError ? <p className={actionStyles.errorText}>{invoiceError}</p> : null}
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.itemsSection}>
          <h3 className={styles.sectionTitle}>{t("itemsTitle")}</h3>

          <div className={styles.itemsList}>
            {orderDetails.items.map((item) => (
              <article key={item.sku} className={styles.itemCard}>
                <div className={styles.itemMain}>
                  <p className={styles.itemName}>
                    {formatItemName(item.name, t("defaultItemName"))}
                  </p>
                  <p className={styles.itemMeta}>{t("sku", { sku: item.sku })}</p>
                </div>
                <div className={styles.itemQuantityContainer}>
                  <p className={styles.itemQuantity}>{t("qty", { quantity: item.quantity })}</p>
                  {item.refundedQuantity && item.refundedQuantity > 0 ? (
                    <span className={styles.refundedBadge}>
                      {t("refundedQty", { quantity: item.refundedQuantity })}
                    </span>
                  ) : null}
                </div>
                <p className={styles.itemPrice}>
                  {formatCents(item.unitPriceCents * item.quantity)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside className={styles.sidebar}>
          <section className={styles.infoCard}>
            <h3 className={styles.sectionTitle}>{t("deliveryTitle")}</h3>
            <div className={styles.infoGroup}>
              <p className={styles.infoLabel}>{t("vendor")}</p>
              <p className={styles.infoValue}>{data.vendorName}</p>
            </div>
            <div className={styles.infoGroup}>
              <p className={styles.infoLabel}>{t("status")}</p>
              <p className={styles.infoValue}>{formatStatus(data.status, t)}</p>
            </div>
          </section>

          <section className={styles.infoCard}>
            <h3 className={styles.sectionTitle}>{t("deliveryAddress")}</h3>
            <div className={styles.addressBlock}>
              <p className={styles.infoValue}>{orderDetails.delivery.addressLabel}</p>
            </div>

            {instructions && (instructions.freeForm || instructions.apartmentEntrance) ? (
              <div className={styles.infoGroup}>
                <p className={styles.infoLabel}>{t("deliveryInstructions")}</p>
                {instructions.apartmentEntrance ? (
                  <p className={styles.addressLine}>
                    {t("access", { access: instructions.apartmentEntrance })}
                  </p>
                ) : null}
                {instructions.doorCode ? (
                  <p className={styles.addressLine}>
                    {t("doorCode", { code: instructions.doorCode })}
                  </p>
                ) : null}
                {instructions.freeForm ? (
                  <p className={styles.addressLine}>{instructions.freeForm}</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={styles.infoCard}>
            <h3 className={styles.sectionTitle}>{tPricing("orderSummaryTitle")}</h3>
            <PricingRow
              label={tPricing("itemsSubtotal")}
              value={formatCents(pricing.itemsSubtotalCents)}
            />
            {pricing.itemsDiscountCents !== null ? (
              <>
                <PricingRow
                  label={tPricing("itemDiscount")}
                  value={`-${formatCents(pricing.itemsDiscountCents)}`}
                />
                <PricingRow
                  label={tPricing("discountedItemsSubtotal")}
                  value={formatCents(
                    pricing.discountedItemsSubtotalCents ?? pricing.itemsSubtotalCents,
                  )}
                />
              </>
            ) : null}
            <PricingRow
              label={tPricing("total")}
              value={formatCents(pricing.chargedTotalCents)}
              strong
            />
            <PricingRow
              label={tPricing("includedVat", { rate: pricing.vatRate })}
              value={formatCents(pricing.includedVatCents)}
            />
            {pricing.refundedCents ? (
              <>
                <div className={styles.divider} />
                <PricingRow
                  label={t("refundedTotal")}
                  value={`-${formatCents(pricing.refundedCents)}`}
                  strong
                />
              </>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
