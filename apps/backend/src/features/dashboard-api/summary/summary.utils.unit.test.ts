import assert from "node:assert";
import { describe, it } from "node:test";

import { Decimal } from "@prisma/client/runtime/client";

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

      assert.strictEqual(result.getFullYear(), 2026);
      assert.strictEqual(result.getMonth(), 3);
      assert.strictEqual(result.getDate(), 13);
      assert.strictEqual(result.getHours(), 0);
      assert.strictEqual(result.getMinutes(), 0);
      assert.strictEqual(result.getSeconds(), 0);
      assert.strictEqual(result.getMilliseconds(), 0);
    });
  });

  describe("getSummaryWindowBounds", () => {
    it("builds current and previous windows from the provided date and day count", () => {
      const now = new Date("2026-04-13T18:42:11.123Z");

      const result = getSummaryWindowBounds(now, 7);

      assert.strictEqual(result.currentStart.getFullYear(), 2026);
      assert.strictEqual(result.currentStart.getMonth(), 3);
      assert.strictEqual(result.currentStart.getDate(), 7);
      assert.strictEqual(result.currentStart.getHours(), 0);
      assert.strictEqual(result.currentStart.getMinutes(), 0);
      assert.strictEqual(result.previousStart.getFullYear(), 2026);
      assert.strictEqual(result.previousStart.getMonth(), 2);
      assert.strictEqual(result.previousStart.getDate(), 31);
      assert.strictEqual(result.previousStart.getHours(), 0);
      assert.strictEqual(result.previousStart.getMinutes(), 0);
    });
  });

  describe("getDeltaPercent", () => {
    it("returns zero when both current and previous are zero", () => {
      assert.strictEqual(getDeltaPercent(0, 0), 0);
    });

    it("returns 100 when previous is zero and current is non-zero", () => {
      assert.strictEqual(getDeltaPercent(12, 0), 100);
    });

    it("calculates percentage deltas for normal comparisons", () => {
      assert.strictEqual(getDeltaPercent(150, 100), 50);
      assert.strictEqual(getDeltaPercent(75, 100), -25);
    });
  });

  describe("toCoverage", () => {
    it("returns zero percent when outOf is zero", () => {
      assert.deepStrictEqual(toCoverage(0, 0), {
        percentage: 0,
        completed: 0,
        outOf: 0,
      });
    });

    it("calculates percentage from completed and outOf", () => {
      assert.deepStrictEqual(toCoverage(3, 4), {
        percentage: 75,
        completed: 3,
        outOf: 4,
      });
    });
  });

  describe("normalizeRevenueByDay", () => {
    it("normalizes revenue and order counts into numbers", () => {
      const result = normalizeRevenueByDay([
        { date: "2026-04-12", revenue: "12.5", orders: "3" },
        { date: "2026-04-13", revenue: 0, orders: 0 },
      ]);

      assert.deepStrictEqual(result, [
        { date: "2026-04-12", revenue: 12.5, orders: 3 },
        { date: "2026-04-13", revenue: 0, orders: 0 },
      ]);
    });

    it("returns an empty array for an empty chart", () => {
      assert.deepStrictEqual(normalizeRevenueByDay([]), []);
    });
  });

  describe("buildSummaryResponse", () => {
    it("builds the response shape from query rows", () => {
      const now = new Date("2026-04-13T18:42:11.123Z");

      const result = buildSummaryResponse({
        now,
        days: 30,
        orderRow: {
          current_revenue: new Decimal("125.5"),
          previous_revenue: new Decimal("100"),
          current_paid_orders: 5,
          previous_paid_orders: 4,
          chart: [{ date: "2026-04-13", revenue: "125.5", orders: "5" }],
        },
        activeProducts: 8,
        customers: 12,
        localizationRow: {
          out_of: 10,
          completed_all_locales: 4,
          completed_by_locale: { en: 9 },
        },
      });

      assert.deepStrictEqual(result, {
        generatedAt: now,
        windowDays: 30,
        kpis: {
          totalRevenue: new Decimal("125.5"),
          revenueDeltaPct: 25.5,
          paidOrders: 5,
          paidOrdersDeltaPct: 25,
          activeProducts: 8,
          customers: 12,
        },
        chart: {
          revenueByDay: [{ date: "2026-04-13", revenue: 125.5, orders: 5 }],
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
          current_revenue: new Decimal("0"),
          previous_revenue: new Decimal("0"),
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

      assert.deepStrictEqual(result.kpis, {
        totalRevenue: new Decimal("0"),
        revenueDeltaPct: 0,
        paidOrders: 0,
        paidOrdersDeltaPct: 0,
        activeProducts: 0,
        customers: 0,
      });
      assert.deepStrictEqual(result.chart, {
        revenueByDay: [],
      });
      assert.deepStrictEqual(result.localizationCoverage, {
        overall: { percentage: 0, completed: 0, outOf: 0 },
        byLocale: {
          en: { percentage: 0, completed: 0, outOf: 0 },
        },
      });
    });
  });
});
