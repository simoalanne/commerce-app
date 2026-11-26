import { calculateOrderPricing } from "@acme/shared";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { Db } from "#src/db/client.ts";

import {
  buildValues,
  commitReservedStock,
  releaseReservedStock,
  reserveStockOrThrow,
} from "./checkout.adjustStock.ts";
import { InsufficientStock, PriceMismatch, ProductsNotPurchasable } from "./checkout.errors.ts";
import {
  buildOrderItemsFromProducts,
  calculateOrderTotal,
  validateCartUnitPrices,
} from "./checkout.utils.ts";

const dialect = new PgDialect();
const normalizeSql = (sql: string) => sql.replace(/\s+/g, " ").trim();
const assertRouteError = (
  error: unknown,
  Definition: new (...args: never[]) => { data?: unknown },
  data: unknown,
) => {
  expect(error).toBeInstanceOf(Definition);
  expect(error).toHaveProperty("data", data);
};

// Records the queries a stock command runs, as SQL text and parameters.
const recordingTransaction = (rows: unknown[] = []) => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const transaction = {
    execute: async (query: SQL) => {
      const { sql, params } = dialect.sqlToQuery(query);
      queries.push({ sql: normalizeSql(sql), params });
      return { rows };
    },
  };
  // A stub of the one method the stock commands use.
  return { queries, transaction: transaction as unknown as Db };
};

describe("checkout.adjustStock", () => {
  describe("buildValues", () => {
    it("builds parameterized SQL values for multiple items", () => {
      const items = [
        { sku: "SKU123", quantity: 5 },
        { sku: "SKU456", quantity: 10 },
      ];

      expect(dialect.sqlToQuery(buildValues(items))).toEqual({
        sql: "($1::text, $2::int), ($3::text, $4::int)",
        params: ["SKU123", 5, "SKU456", 10],
      });
    });
  });

  describe("stock adjustment commands", () => {
    it("builds reserve SQL that increments reserved stock only when available stock is sufficient", async () => {
      const { queries, transaction } = recordingTransaction();

      await reserveStockOrThrow({ items: [{ sku: "SKU1", quantity: 2 }], transaction });

      expect(queries.length).toBe(1);
      const { sql, params } = queries[0];
      expect(sql).toMatch(/WITH requested\(sku, quantity\) AS/);
      expect(sql).toMatch(/SET reserved_stock = p\.reserved_stock \+ r\.quantity/);
      expect(sql).toMatch(/AND \(p\.current_stock - p\.reserved_stock\) >= r\.quantity/);
      expect(sql).toMatch(/u\.sku IS NOT NULL AS adjusted/);
      expect(params).toEqual(["SKU1", 2]);
    });

    it("builds commit SQL that decrements both current and reserved stock", async () => {
      const { queries, transaction } = recordingTransaction();

      await commitReservedStock({ items: [{ sku: "SKU1", quantity: 2 }], transaction });

      expect(queries.length).toBe(1);
      const { sql, params } = queries[0];
      expect(sql).toMatch(/SET current_stock = p\.current_stock - s\.quantity,/);
      expect(sql).toMatch(/reserved_stock = p\.reserved_stock - s\.quantity/);
      expect(sql).toMatch(/FROM \(VALUES \(\$1::text, \$2::int\)\) AS s\(sku, quantity\)/);
      expect(params).toEqual(["SKU1", 2]);
    });

    it("builds release SQL that decrements only reserved stock", async () => {
      const { queries, transaction } = recordingTransaction();

      await releaseReservedStock({ items: [{ sku: "SKU1", quantity: 2 }], transaction });

      expect(queries.length).toBe(1);
      const { sql } = queries[0];
      expect(sql).toMatch(/SET reserved_stock = p\.reserved_stock - s\.quantity/);
      expect(sql).not.toMatch(/current_stock =/);
    });

    it("throws a domain error when reserve query reports failed rows", async () => {
      const { transaction } = recordingTransaction([
        { sku: "SKU1", availableStock: 0, adjusted: false },
      ]);

      try {
        await reserveStockOrThrow({ items: [{ sku: "SKU1", quantity: 2 }], transaction });
        expect.unreachable("Expected reserveStockOrThrow to throw");
      } catch (error) {
        assertRouteError(error, InsufficientStock, [{ sku: "SKU1", availableStock: 0 }]);
      }
    });
  });
});

describe("checkout.utils", () => {
  describe("buildOrderItemsFromProducts", () => {
    it("maps cart quantities and prices into order items", () => {
      const products = [
        {
          id: 1,
          sku: "SKU1",
          name: { en: "Product 1" },
          vendorId: 10,
          vendor: { name: "Vendor 1" },
          costPriceCents: 80,
          salesPriceCents: 100,
        },
        {
          id: 2,
          sku: "SKU2",
          name: { en: "Product 2" },
          vendorId: 20,
          vendor: { name: "Vendor 2" },
          costPriceCents: 150,
          salesPriceCents: 200,
        },
      ] as any;

      const result = buildOrderItemsFromProducts(products, {
        SKU1: { quantity: 2, unitPriceCents: 100 },
        SKU2: { quantity: 1, unitPriceCents: 200 },
      });

      expect(result).toStrictEqual([
        {
          sku: "SKU1",
          productId: 1,
          productName: "Product 1",
          vendorId: 10,
          vendorName: "Vendor 1",
          quantity: 2,
          unitPriceCents: 100,
          unitCostPriceCents: 80,
        },
        {
          sku: "SKU2",
          productId: 2,
          productName: "Product 2",
          vendorId: 20,
          vendorName: "Vendor 2",
          quantity: 1,
          unitPriceCents: 200,
          unitCostPriceCents: 150,
        },
      ]);
    });

    it("throws a domain error for invalid skus", () => {
      const products = [
        {
          sku: "SKU1",
          costPriceCents: 80,
          salesPriceCents: 100,
        },
      ] as any;

      try {
        buildOrderItemsFromProducts(products, {
          SKU1: { quantity: 1, unitPriceCents: 100 },
          INVALID: { quantity: 2, unitPriceCents: 50 },
        });
        expect.unreachable("Expected buildOrderItemsFromProducts to throw");
      } catch (error) {
        assertRouteError(error, ProductsNotPurchasable, {
          skus: ["INVALID"],
        });
      }
    });
  });

  describe("validateCartUnitPrices", () => {
    it("does nothing when client and database prices match", () => {
      const products = [{ sku: "SKU1", salesPriceCents: 100 }] as any;

      expect(() =>
        validateCartUnitPrices(products, {
          SKU1: { quantity: 1, unitPriceCents: 100 },
        }),
      ).not.toThrow();
    });

    it("throws a domain error when a unit price has changed", () => {
      const products = [
        { sku: "SKU1", salesPriceCents: 125 },
        { sku: "SKU2", salesPriceCents: 200 },
      ] as any;

      try {
        validateCartUnitPrices(products, {
          SKU1: { quantity: 1, unitPriceCents: 100 },
          SKU2: { quantity: 2, unitPriceCents: 200 },
        });
        expect.unreachable("Expected validateCartUnitPrices to throw");
      } catch (error) {
        assertRouteError(error, PriceMismatch, [{ sku: "SKU1", newUnitPriceCents: 125 }]);
      }
    });
  });

  describe("calculateOrderTotal", () => {
    it("calculates the total from price and quantity", () => {
      const total = calculateOrderTotal([
        { unitPriceCents: 100, quantity: 2 },
        { unitPriceCents: 50, quantity: 3 },
      ]);

      expect(total).toBe(350);
    });

    it("returns zero for empty or zero-value items", () => {
      expect(calculateOrderTotal([])).toBe(0);
      expect(
        calculateOrderTotal([
          { unitPriceCents: 0, quantity: 5 },
          { unitPriceCents: 100, quantity: 0 },
        ]),
      ).toBe(0);
    });
  });

  describe("calculateOrderPricing", () => {
    it("returns unchanged pricing when no promo code is applied", () => {
      expect(calculateOrderPricing({ itemsSubtotalCents: 2500 })).toStrictEqual({
        itemsSubtotalCents: 2500,
        itemsDiscountCents: null,
        discountedItemsSubtotalCents: null,
        chargedTotalCents: 2500,
        vatRate: 20,
        includedVatCents: 417,
      });
    });

    it("applies percent discounts", () => {
      expect(
        calculateOrderPricing({
          itemsSubtotalCents: 2000,
          discountType: "PERCENT",
          discountValue: 25,
        }),
      ).toStrictEqual({
        itemsSubtotalCents: 2000,
        itemsDiscountCents: 500,
        discountedItemsSubtotalCents: 1500,
        chargedTotalCents: 1500,
        vatRate: 20,
        includedVatCents: 250,
      });
    });

    it("caps fixed discounts at the items subtotal", () => {
      expect(
        calculateOrderPricing({
          itemsSubtotalCents: 700,
          discountType: "FIXED",
          discountValue: 2000,
        }),
      ).toStrictEqual({
        itemsSubtotalCents: 700,
        itemsDiscountCents: 700,
        discountedItemsSubtotalCents: 0,
        chargedTotalCents: 0,
        vatRate: 20,
        includedVatCents: 0,
      });
    });

    it("rounds percent discounts to whole cents", () => {
      expect(
        calculateOrderPricing({
          itemsSubtotalCents: 1999,
          discountType: "PERCENT",
          discountValue: 10,
        }),
      ).toStrictEqual({
        itemsSubtotalCents: 1999,
        itemsDiscountCents: 200,
        discountedItemsSubtotalCents: 1799,
        chargedTotalCents: 1799,
        vatRate: 20,
        includedVatCents: 300,
      });
    });
  });
});
