import { calculateOrderPricing } from "@acme/shared";

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

const normalizeSql = (sql: string) => sql.replace(/\s+/g, " ").trim();
const assertRouteError = (
  error: unknown,
  Definition: new (...args: never[]) => { data?: unknown },
  data: unknown,
) => {
  expect(error).toBeInstanceOf(Definition);
  expect(error).toHaveProperty("data", data);
};
const decimal = (value: number) => ({ toNumber: () => value });

describe("checkout.adjustStock", () => {
  describe("buildValues", () => {
    it("builds SQL values for multiple items", () => {
      const items = [
        { sku: "SKU123", quantity: 5 },
        { sku: "SKU456", quantity: 10 },
      ];

      expect(buildValues(items)).toBe("('SKU123'::text, 5::int), ('SKU456'::text, 10::int)");
    });

    it("escapes single quotes in sku values", () => {
      const items = [{ sku: "SKU WITH 'QUOTE", quantity: 3 }];

      expect(buildValues(items)).toBe("('SKU WITH ''QUOTE'::text, 3::int)");
    });

    it("returns an empty string for empty items", () => {
      expect(buildValues([])).toBe("");
    });
  });

  describe("stock adjustment commands", () => {
    it("builds reserve SQL that increments reserved stock only when available stock is sufficient", async () => {
      const sqlCalls: string[] = [];
      const transaction = {
        $queryRawUnsafe: async (sql: string) => {
          sqlCalls.push(sql);
          return [];
        },
      };

      await reserveStockOrThrow({
        items: [{ sku: "SKU1", quantity: 2 }],
        transaction: transaction as any,
      });

      expect(sqlCalls.length).toBe(1);
      const sql = normalizeSql(sqlCalls[0]);
      expect(sql).toMatch(/WITH requested\(sku, quantity\) AS/);
      expect(sql).toMatch(/SET reserved_stock = p\.reserved_stock \+ r\.quantity/);
      expect(sql).toMatch(/AND \(p\.current_stock - p\.reserved_stock\) >= r\.quantity/);
      expect(sql).toMatch(/u\.sku IS NOT NULL AS adjusted/);
    });

    it("builds commit SQL that decrements both current and reserved stock", async () => {
      const sqlCalls: string[] = [];
      const transaction = {
        $executeRawUnsafe: async (sql: string) => {
          sqlCalls.push(sql);
          return 0;
        },
      };

      await commitReservedStock({
        items: [{ sku: "SKU1", quantity: 2 }],
        transaction: transaction as any,
      });

      expect(sqlCalls.length).toBe(1);
      const sql = normalizeSql(sqlCalls[0]);
      expect(sql).toMatch(/SET current_stock = p\.current_stock - s\.quantity,/);
      expect(sql).toMatch(/reserved_stock = p\.reserved_stock - s\.quantity/);
      expect(sql).toMatch(/FROM \(VALUES \('SKU1'::text, 2::int\)\) AS s\(sku, quantity\)/);
    });

    it("builds release SQL that decrements only reserved stock", async () => {
      const sqlCalls: string[] = [];
      const transaction = {
        $executeRawUnsafe: async (sql: string) => {
          sqlCalls.push(sql);
          return 0;
        },
      };

      await releaseReservedStock({
        items: [{ sku: "SKU1", quantity: 2 }],
        transaction: transaction as any,
      });

      expect(sqlCalls.length).toBe(1);
      const sql = normalizeSql(sqlCalls[0]);
      expect(sql).toMatch(/SET reserved_stock = p\.reserved_stock - s\.quantity/);
      expect(sql).not.toMatch(/current_stock =/);
    });

    it("throws a domain error when reserve query reports failed rows", async () => {
      const transaction = {
        $queryRawUnsafe: async () => [{ sku: "SKU1", availableStock: 0, adjusted: false }],
      };

      try {
        await reserveStockOrThrow({
          items: [{ sku: "SKU1", quantity: 2 }],
          transaction: transaction as any,
        });
        expect.unreachable("Expected reserveStockOrThrow to throw");
      } catch (error) {
        assertRouteError(error, InsufficientStock, [{ sku: "SKU1", availableStock: 0 }]);
      }
    });
  });
});

describe("checkout.utils", () => {
  describe("buildOrderItemsFromProducts", () => {
    it("maps cart quantities and decimal prices into order items", () => {
      const products = [
        {
          id: 1,
          sku: "SKU1",
          name: { en: "Product 1" },
          vendor_id: 10,
          vendor: { name: "Vendor 1" },
          cost_price: decimal(80),
          sales_price: decimal(100),
          weight_grams: 250,
        },
        {
          id: 2,
          sku: "SKU2",
          name: { en: "Product 2" },
          vendor_id: 20,
          vendor: { name: "Vendor 2" },
          cost_price: decimal(150),
          sales_price: decimal(200),
          weight_grams: 500,
        },
      ] as any;

      const result = buildOrderItemsFromProducts(products, {
        SKU1: { quantity: 2, unitPrice: 100 },
        SKU2: { quantity: 1, unitPrice: 200 },
      });

      expect(result).toStrictEqual([
        {
          sku: "SKU1",
          productId: 1,
          productName: "Product 1",
          vendorId: 10,
          vendorName: "Vendor 1",
          quantity: 2,
          unitPrice: 100,
          unitCostPrice: 80,
          weightGrams: 250,
        },
        {
          sku: "SKU2",
          productId: 2,
          productName: "Product 2",
          vendorId: 20,
          vendorName: "Vendor 2",
          quantity: 1,
          unitPrice: 200,
          unitCostPrice: 150,
          weightGrams: 500,
        },
      ]);
    });

    it("throws a domain error for invalid skus", () => {
      const products = [
        {
          sku: "SKU1",
          cost_price: decimal(80),
          sales_price: decimal(100),
          weight_grams: 250,
        },
      ] as any;

      try {
        buildOrderItemsFromProducts(products, {
          SKU1: { quantity: 1, unitPrice: 100 },
          INVALID: { quantity: 2, unitPrice: 50 },
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
      const products = [{ sku: "SKU1", sales_price: decimal(100) }] as any;

      expect(() =>
        validateCartUnitPrices(products, {
          SKU1: { quantity: 1, unitPrice: 100 },
        }),
      ).not.toThrow();
    });

    it("throws a domain error when a unit price has changed", () => {
      const products = [
        { sku: "SKU1", sales_price: decimal(125) },
        { sku: "SKU2", sales_price: decimal(200) },
      ] as any;

      try {
        validateCartUnitPrices(products, {
          SKU1: { quantity: 1, unitPrice: 100 },
          SKU2: { quantity: 2, unitPrice: 200 },
        });
        expect.unreachable("Expected validateCartUnitPrices to throw");
      } catch (error) {
        assertRouteError(error, PriceMismatch, [{ sku: "SKU1", newUnitPrice: 125 }]);
      }
    });
  });

  describe("calculateOrderTotal", () => {
    it("calculates the total from price and quantity", () => {
      const total = calculateOrderTotal([
        { unitPrice: 100, quantity: 2 },
        { unitPrice: 50, quantity: 3 },
      ]);

      expect(total).toBe(350);
    });

    it("returns zero for empty or zero-value items", () => {
      expect(calculateOrderTotal([])).toBe(0);
      expect(
        calculateOrderTotal([
          { unitPrice: 0, quantity: 5 },
          { unitPrice: 100, quantity: 0 },
        ]),
      ).toBe(0);
    });
  });

  describe("calculateOrderPricing", () => {
    it("returns unchanged pricing when no promo code is applied", () => {
      expect(calculateOrderPricing({ itemsSubtotal: 25 })).toStrictEqual({
        itemsSubtotal: 25,
        itemsDiscountAmount: null,
        discountedItemsSubtotal: null,
        chargedTotal: 25,
        vatRate: 20,
        includedVatAmount: 4.17,
      });
    });

    it("applies percent discounts", () => {
      expect(
        calculateOrderPricing({ itemsSubtotal: 20, discountType: "PERCENT", discountValue: 25 }),
      ).toStrictEqual({
        itemsSubtotal: 20,
        itemsDiscountAmount: 5,
        discountedItemsSubtotal: 15,
        chargedTotal: 15,
        vatRate: 20,
        includedVatAmount: 2.5,
      });
    });

    it("caps fixed discounts at the items subtotal", () => {
      expect(
        calculateOrderPricing({ itemsSubtotal: 7, discountType: "FIXED", discountValue: 20 }),
      ).toStrictEqual({
        itemsSubtotal: 7,
        itemsDiscountAmount: 7,
        discountedItemsSubtotal: 0,
        chargedTotal: 0,
        vatRate: 20,
        includedVatAmount: 0,
      });
    });

    it("rounds percent-based discounts through cents", () => {
      expect(
        calculateOrderPricing({ itemsSubtotal: 19.99, discountType: "PERCENT", discountValue: 10 }),
      ).toStrictEqual({
        itemsSubtotal: 19.99,
        itemsDiscountAmount: 2,
        discountedItemsSubtotal: 17.99,
        chargedTotal: 17.99,
        vatRate: 20,
        includedVatAmount: 3,
      });
    });
  });
});
