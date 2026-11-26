import type { Prisma } from "@prisma/client";

import { supportedLocales } from "#src/locales.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const getSummaryWindowBounds = (now: Date, days: number) => {
  const currentStart = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  const previousStart = new Date(currentStart.getTime() - days * DAY_MS);

  return {
    currentStart,
    previousStart,
  };
};

type NumericLike = number | Prisma.Decimal;

const toNumber = (value: NumericLike) => (typeof value === "number" ? value : value.toNumber());

export const getDeltaPercent = (current: NumericLike, previous: NumericLike) => {
  const currentNumber = toNumber(current);
  const previousNumber = toNumber(previous);

  if (previousNumber === 0) {
    return currentNumber === 0 ? 0 : 100;
  }

  return ((currentNumber - previousNumber) / previousNumber) * 100;
};

export const toCoverage = (completed: number, outOf: number) => ({
  percentage: outOf === 0 ? 0 : (completed / outOf) * 100,
  completed,
  outOf,
});

export type ChartItem = {
  date: string;
  revenueCents: number | string;
  orders: number | string;
};

export const normalizeRevenueByDay = (chart: ChartItem[]) =>
  chart.map((item) => ({
    date: item.date,
    revenueCents: Number(item.revenueCents),
    orders: Number(item.orders),
  }));

export type OrderQueryRow = {
  current_revenue: Prisma.Decimal;
  previous_revenue: Prisma.Decimal;
  current_paid_orders: number;
  previous_paid_orders: number;
  chart: ChartItem[];
};

export type LocalizationCoverageRow = {
  out_of: number;
  completed_all_locales: number;
  // Null when there is nothing to localize.
  completed_by_locale: Record<string, number> | null;
};

export const buildSummaryResponse = ({
  now,
  days,
  orderRow,
  activeProducts,
  customers,
  localizationRow,
}: {
  now: Date;
  days: number;
  orderRow: OrderQueryRow;
  activeProducts: number;
  customers: number;
  localizationRow: LocalizationCoverageRow;
}) => {
  const currentRevenue = orderRow.current_revenue;
  const currentPaidOrders = orderRow.current_paid_orders;
  const previousPaidOrders = orderRow.previous_paid_orders;

  return {
    generatedAt: now,
    windowDays: days,
    kpis: {
      totalRevenueCents: currentRevenue,
      revenueDeltaPct: getDeltaPercent(orderRow.current_revenue, orderRow.previous_revenue),
      paidOrders: currentPaidOrders,
      paidOrdersDeltaPct: getDeltaPercent(currentPaidOrders, previousPaidOrders),
      activeProducts,
      customers,
    },
    chart: {
      revenueByDay: normalizeRevenueByDay(orderRow.chart),
    },
    localizationCoverage: {
      overall: toCoverage(localizationRow.completed_all_locales, localizationRow.out_of),
      byLocale: Object.fromEntries(
        supportedLocales.map((locale) => [
          locale,
          toCoverage(localizationRow.completed_by_locale?.[locale] ?? 0, localizationRow.out_of),
        ]),
      ),
    },
  };
};
