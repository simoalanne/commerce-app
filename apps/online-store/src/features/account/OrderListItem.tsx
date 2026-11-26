"use client";

import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Api } from "@/api/client";
import type { CartItems } from "@/features/checkout/cartState";
import { useCart } from "@/hooks/useCart";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getValidLocale } from "@/i18n/routing";
import { useApiClient } from "@/providers/ApiClientProvider";
import { formatCents } from "@/utils/formatPrice";

import styles from "./OrderListItem.module.css";

export type OrderSummary = InferClientResponse<Api["orders"]["list"]>["body"][number];

type OrderListItemProps = {
  order: OrderSummary;
  locale: string;
};

function getStatusTone(status: OrderSummary["status"]) {
  switch (status) {
    case "PAID":
      return styles.statusOpen;
    case "DELIVERED":
      return styles.statusPaid;
    default:
      return styles.statusClosed;
  }
}

function getStatusLabel(
  getLabel: (key: "statusAwaitingDelivery" | "statusDelivered" | "statusUnknown") => string,
  status: OrderSummary["status"],
) {
  switch (status) {
    case "PAID":
      return getLabel("statusAwaitingDelivery");
    case "DELIVERED":
      return getLabel("statusDelivered");
    default:
      return getLabel("statusUnknown");
  }
}

function getPaymentLabel(
  getLabel: (key: "paymentPaid" | "paymentUnknown") => string,
  status: OrderSummary["status"],
) {
  switch (status) {
    case "PAID":
    case "DELIVERED":
      return getLabel("paymentPaid");
    default:
      return getLabel("paymentUnknown");
  }
}

function formatDate(date: Date, locale: string) {
  const activeLocale = getValidLocale(locale);

  return new Intl.DateTimeFormat(activeLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getItemText(order: OrderSummary, defaultText: string, more: string) {
  const itemName = order.itemPreview?.name;
  const safeItemName =
    typeof itemName === "string" && itemName.trim().length > 0 ? itemName : defaultText;

  if (order.remainingItemCount === 0) {
    return safeItemName;
  }

  return `${safeItemName} + ${order.remainingItemCount} ${more}`;
}

export function OrderListItem({ order, locale }: OrderListItemProps) {
  const t = useTranslations("orderListItem");
  const reorderT = useTranslations("ordersPage.reorder");
  const { queryUtils } = useApiClient();
  const { replaceCart } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const reviewAccessToken = useMutation(queryUtils.orders.createAccessToken.mutationOptions());
  const href = `${pathname}/${order.id}`;
  const itemCount = order.remainingItemCount + (order.itemPreview ? 1 : 0);

  const handleReviewOrder = async () => {
    const result = await reviewAccessToken.mutateAsync({
      body: {
        orderId: order.id,
        scope: "order:review",
      },
    });
    router.push(
      `/review-order/access-token?orderId=${order.id}&token=${encodeURIComponent(result.body.accessToken)}&format=jwt`,
    );
  };

  const handleReorder = async () => {
    setIsReordering(true);
    setReorderError(null);

    try {
      const { body: orderDetail } = await queryUtils.orders.getById.fetch({
        params: { orderId: order.id },
      });
      const items = orderDetail.orderDetails.items.reduce((cartItems, item) => {
        cartItems[item.sku] = {
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        };
        return cartItems;
      }, {} as CartItems);

      await replaceCart({ items });
      router.push("/cart");
    } catch {
      setReorderError(t("error"));
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <article className={styles.card}>
      <Link href={href} className={styles.cardLink} prefetch={false}>
        <div className={styles.main}>
          <p className={styles.title}>
            <span>#{order.id}</span>
            <span className={`${styles.status} ${getStatusTone(order.status)}`}>
              {getStatusLabel(t, order.status)}
            </span>
          </p>
          <p className={styles.meta}>{getItemText(order, t("defaultItemName"), t("more"))}</p>
        </div>

        <div className={styles.block}>
          <p className={styles.blockLabel}>{t("placedLabel")}</p>
          <p className={styles.blockValue}>{formatDate(new Date(order.createdAt), locale)}</p>
        </div>

        <div className={styles.block}>
          <p className={styles.blockLabel}>{t("paymentLabel")}</p>
          <p className={styles.blockValue}>{getPaymentLabel(t, order.status)}</p>
        </div>

        <div className={styles.priceBlock}>
          <strong>{formatCents(order.totalCents)}</strong>
          <span>{t("itemCount", { count: itemCount })}</span>
        </div>
      </Link>

      <div className={styles.actions}>
        {order.status === "DELIVERED" && !order.hasSubmittedReview ? (
          <button
            type="button"
            className={styles.reorderButton}
            onClick={() => void handleReviewOrder()}
            disabled={reviewAccessToken.isPending}
          >
            {t("reviewOrder")}
          </button>
        ) : null}

        <button
          type="button"
          className={styles.reorderButton}
          onClick={() => void handleReorder()}
          disabled={isReordering}
        >
          {isReordering ? reorderT("pending") : reorderT("cta")}
        </button>
        {reorderError ? <p className={styles.errorText}>{reorderError}</p> : null}
      </div>
    </article>
  );
}
