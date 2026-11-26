import {
  buildSummaryResponse,
  getDeltaPercent,
  getSummaryWindowBounds,
  normalizeRevenueByDay,
  startOfDay,
  toCoverage,
} from "./summary.utils.ts";

describe("summary.utils", () => {
  describe("startOfDay", () => {
    it("drops the time portion from a date", () => {
      const result = startOfDay(new Date("2026-04-13T18:42:11.123Z"));

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(3);
      expect(result.getDate()).toBe(13);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe("getSummaryWindowBounds", () => {
    it("builds current and previous windows from the provided date and day count", () => {
      const now = new Date("2026-04-13T18:42:11.123Z");

      const result = getSummaryWindowBounds(now, 7);

      expect(result.currentStart.getFullYear()).toBe(2026);
      expect(result.currentStart.getMonth()).toBe(3);
      expect(result.currentStart.getDate()).toBe(7);
      expect(result.currentStart.getHours()).toBe(0);
      expect(result.currentStart.getMinutes()).toBe(0);
      expect(result.previousStart.getFullYear()).toBe(2026);
      expect(result.previousStart.getMonth()).toBe(2);
      expect(result.previousStart.getDate()).toBe(31);
      expect(result.previousStart.getHours()).toBe(0);
      expect(result.previousStart.getMinutes()).toBe(0);
    });
  });

  describe("getDeltaPercent", () => {
    it("returns zero when both current and previous are zero", () => {
      expect(getDeltaPercent(0, 0)).toBe(0);
    });

    it("returns 100 when previous is zero and current is non-zero", () => {
      expect(getDeltaPercent(12, 0)).toBe(100);
    });

    it("calculates percentage deltas for normal comparisons", () => {
      expect(getDeltaPercent(150, 100)).toBe(50);
      expect(getDeltaPercent(75, 100)).toBe(-25);
    });
  });

  describe("toCoverage", () => {
    it("returns zero percent when outOf is zero", () => {
      expect(toCoverage(0, 0)).toStrictEqual({
        percentage: 0,
        completed: 0,
        outOf: 0,
      });
    });

    it("calculates percentage from completed and outOf", () => {
      expect(toCoverage(3, 4)).toStrictEqual({
        percentage: 75,
        completed: 3,
        outOf: 4,
      });
    });
  });

  describe("normalizeRevenueByDay", () => {
    it("normalizes revenue and order counts into numbers", () => {
      const result = normalizeRevenueByDay([
        { date: "2026-04-12", revenueCents: "1250", orders: "3" },
        { date: "2026-04-13", revenueCents: 0, orders: 0 },
      ]);

      expect(result).toStrictEqual([
        { date: "2026-04-12", revenueCents: 1250, orders: 3 },
        { date: "2026-04-13", revenueCents: 0, orders: 0 },
      ]);
    });

    it("returns an empty array for an empty chart", () => {
      expect(normalizeRevenueByDay([])).toStrictEqual([]);
    });
  });

  describe("buildSummaryResponse", () => {
    it("builds the response shape from query rows", () => {
      const now = new Date("2026-04-13T18:42:11.123Z");

      const result = buildSummaryResponse({
        now,
        days: 30,
        orderRow: {
          current_revenue: "12550",
          previous_revenue: "10000",
          current_paid_orders: 5,
          previous_paid_orders: 4,
          chart: [{ date: "2026-04-13", revenueCents: "12550", orders: "5" }],
        },
        activeProducts: 8,
        customers: 12,
        localizationRow: {
          out_of: 10,
          completed_all_locales: 4,
          completed_by_locale: { en: 9 },
        },
      });

      expect(result).toStrictEqual({
        generatedAt: now.toISOString(),
        windowDays: 30,
        kpis: {
          totalRevenueCents: 12550,
          revenueDeltaPct: 25.5,
          paidOrders: 5,
          paidOrdersDeltaPct: 25,
          activeProducts: 8,
          customers: 12,
        },
        chart: {
          revenueByDay: [{ date: "2026-04-13", revenueCents: 12550, orders: 5 }],
        },
        localizationCoverage: {
          overall: { percentage: 40, completed: 4, outOf: 10 },
          byLocale: {
            en: { percentage: 90, completed: 9, outOf: 10 },
          },
        },
      });
    });

    it("defaults missing rows to zeros cleanly", () => {
      const result = buildSummaryResponse({
        now: new Date("2026-04-13T18:42:11.123Z"),
        days: 7,
        orderRow: {
          current_revenue: "0",
          previous_revenue: "0",
          current_paid_orders: 0,
          previous_paid_orders: 0,
          chart: [],
        },
        activeProducts: 0,
        customers: 0,
        localizationRow: {
          out_of: 0,
          completed_all_locales: 0,
          completed_by_locale: null,
        },
      });

      expect(result.kpis).toStrictEqual({
        totalRevenueCents: 0,
        revenueDeltaPct: 0,
        paidOrders: 0,
        paidOrdersDeltaPct: 0,
        activeProducts: 0,
        customers: 0,
      });
      expect(result.chart).toStrictEqual({
        revenueByDay: [],
      });
      expect(result.localizationCoverage).toStrictEqual({
        overall: { percentage: 0, completed: 0, outOf: 0 },
        byLocale: {
          en: { percentage: 0, completed: 0, outOf: 0 },
        },
      });
    });
  });
});
