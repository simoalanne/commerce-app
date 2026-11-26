"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { AsyncBoundary } from "@/components/async-boundary";
import { useApiClient } from "@/providers/ApiClientProvider";

import type { OrderSummary } from "./OrderListItem";
import { OrderListItem } from "./OrderListItem";

import styles from "./AccountOrdersPage.module.css";

type FilterKey = "open" | "closed";
function isOpenOrder(status: OrderSummary["status"]) {
  return status === "PAID";
}

export default function AccountOrdersPage() {
  return (
    <AsyncBoundary>
      <AccountOrdersPageContent />
    </AsyncBoundary>
  );
}

function AccountOrdersPageContent() {
  const { queryUtils } = useApiClient();
  const locale = useLocale();
  const t = useTranslations("accountOrders");
  const [filter, setFilter] = useState<FilterKey>("open");
  const { data } = useSuspenseQuery(
    queryUtils.orders.list.queryOptions({
      select: (response) => response.body,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }),
  );
  const orders = data ?? [];
  const openOrders = orders.filter((order) => isOpenOrder(order.status));
  const closedOrders = orders.filter((order) => !isOpenOrder(order.status));
  const visibleOrders = filter === "open" ? openOrders : closedOrders;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>{t("title")}</h2>
          <p className={styles.headerText}>{t("description")}</p>
        </div>

        {/* <div className={styles.summary}>
					<span className={styles.summaryChip}>
						{t("openCount", { count: openOrders.length })}
					</span>
					<span className={styles.summaryChip}>
						{t("closedCount", { count: closedOrders.length })}
					</span>
				</div> */}
      </header>

      <div className={styles.surface}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${filter === "open" ? styles.tabActive : ""}`.trim()}
              onClick={() => setFilter("open")}
            >
              {t("openTab", { count: openOrders.length })}
            </button>
            <button
              type="button"
              className={`${styles.tab} ${filter === "closed" ? styles.tabActive : ""}`.trim()}
              onClick={() => setFilter("closed")}
            >
              {t("closedTab", { count: closedOrders.length })}
            </button>
          </div>
        </div>

        <h3 className={styles.sectionTitle}>
          {filter === "open" ? t("sectionTitleOpen") : t("sectionTitleClosed")}
        </h3>

        {visibleOrders.length > 0 ? (
          <div className={styles.list}>
            {visibleOrders.map((order) => (
              <OrderListItem key={order.id} order={order} locale={locale} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>
              {filter === "open" ? t("emptyTitleOpen") : t("emptyTitleClosed")}
            </h3>
            <p className={styles.emptyText}>
              {filter === "open" ? t("emptyTextOpen") : t("emptyTextClosed")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
