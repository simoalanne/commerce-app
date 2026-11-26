import assert from "node:assert";
import { describe, it } from "node:test";

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
  calculateTipAmount,
  validateCartUnitPrices,
} from "./checkout.utils.ts";

const normalizeSql = (sql: string) => sql.replace(/\s+/g, " ").trim();
const assertRouteError = (
  error: unknown,
  Definition: new (...args: never[]) => { data?: unknown },
  data: unknown,
) => {
  assert.ok(error instanceof Definition);
  assert.deepStrictEqual(error.data, data);
};
const decimal = (value: number) => ({ toNumber: () => value });

describe("checkout.adjustStock", () => {
  describe("buildValues", () => {
    it("builds SQL values for multiple items", () => {
      const items = [
        { sku: "SKU123", quantity: 5 },
        { sku: "SKU456", quantity: 10 },
      ];

      assert.strictEqual(buildValues(items), "('SKU123'::text, 5::int), ('SKU456'::text, 10::int)");
    });

    it("escapes single quotes in sku values", () => {
      const items = [{ sku: "SKU WITH 'QUOTE", quantity: 3 }];

      assert.strictEqual(buildValues(items), "('SKU WITH ''QUOTE'::text, 3::int)");
    });

    it("returns an empty string for empty items", () => {
      assert.strictEqual(buildValues([]), "");
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

      assert.strictEqual(sqlCalls.length, 1);
      const sql = normalizeSql(sqlCalls[0]);
      assert.match(sql, /WITH requested\(sku, quantity\) AS/);
      assert.match(sql, /SET reserved_stock = p\.reserved_stock \+ r\.quantity/);
      assert.match(sql, /AND \(p\.current_stock - p\.reserved_stock\) >= r\.quantity/);
      assert.match(sql, /u\.sku IS NOT NULL AS adjusted/);
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

      assert.strictEqual(sqlCalls.length, 1);
      const sql = normalizeSql(sqlCalls[0]);
      assert.match(sql, /SET current_stock = p\.current_stock - s\.quantity,/);
      assert.match(sql, /reserved_stock = p\.reserved_stock - s\.quantity/);
      assert.match(sql, /FROM \(VALUES \('SKU1'::text, 2::int\)\) AS s\(sku, quantity\)/);
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

      assert.strictEqual(sqlCalls.length, 1);
      const sql = normalizeSql(sqlCalls[0]);
      assert.match(sql, /SET reserved_stock = p\.reserved_stock - s\.quantity/);
      assert.doesNotMatch(sql, /current_stock =/);
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
        assert.fail("Expected reserveStockOrThrow to throw");
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

      assert.deepStrictEqual(result, [
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
        assert.fail("Expected buildOrderItemsFromProducts to throw");
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

      assert.doesNotThrow(() =>
        validateCartUnitPrices(products, {
          SKU1: { quantity: 1, unitPrice: 100 },
        }),
      );
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
        assert.fail("Expected validateCartUnitPrices to throw");
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

      assert.strictEqual(total, 350);
    });

    it("returns zero for empty or zero-value items", () => {
      assert.strictEqual(calculateOrderTotal([]), 0);
      assert.strictEqual(
        calculateOrderTotal([
          { unitPrice: 0, quantity: 5 },
          { unitPrice: 100, quantity: 0 },
        ]),
        0,
      );
    });
  });

  describe("calculateTipAmount", () => {
    it("returns zero when no tip percentage is provided", () => {
      assert.strictEqual(calculateTipAmount(25, undefined), 0);
      assert.strictEqual(calculateTipAmount(25, 0), 0);
    });

    it("rounds tip amount through cents", () => {
      assert.strictEqual(calculateTipAmount(19.99, 10), 2);
    });
  });

  describe("calculateOrderPricing", () => {
    it("returns unchanged pricing when no promo code is applied", () => {
      assert.deepStrictEqual(
        calculateOrderPricing({
          itemsSubtotal: 25,
          deliveryFee: 6.9,
          tipPercentage: 0,
        }),
        {
          itemsSubtotal: 25,
          itemsDiscountAmount: null,
          discountedItemsSubtotal: null,
          deliveryFee: 6.9,
          deliveryDiscountAmount: null,
          discountedDeliveryFee: null,
          tipPercentage: null,
          tipAmount: null,
          chargedTotal: 31.9,
          vatRate: 20,
          includedVatAmount: 5.32,
        },
      );
    });

    it("applies percent discounts to items only", () => {
      assert.deepStrictEqual(
        calculateOrderPricing({
          itemsSubtotal: 20,
          deliveryFee: 5,
          tipPercentage: 0,
          discountType: "ITEMS_PERCENT",
          discountValue: 25,
        }),
        {
          itemsSubtotal: 20,
          itemsDiscountAmount: 5,
          discountedItemsSubtotal: 15,
          deliveryFee: 5,
          deliveryDiscountAmount: null,
          discountedDeliveryFee: null,
          tipPercentage: null,
          tipAmount: null,
          chargedTotal: 20,
          vatRate: 20,
          includedVatAmount: 3.33,
        },
      );
    });

    it("caps fixed item discounts at the items subtotal", () => {
      assert.deepStrictEqual(
        calculateOrderPricing({
          itemsSubtotal: 7,
          deliveryFee: 3,
          tipPercentage: 0,
          discountType: "ITEMS_FIXED",
          discountValue: 20,
        }),
        {
          itemsSubtotal: 7,
          itemsDiscountAmount: 7,
          discountedItemsSubtotal: 0,
          deliveryFee: 3,
          deliveryDiscountAmount: null,
          discountedDeliveryFee: null,
          tipPercentage: null,
          tipAmount: null,
          chargedTotal: 3,
          vatRate: 20,
          includedVatAmount: 0.5,
        },
      );
    });

    it("applies percent discounts to delivery only", () => {
      assert.deepStrictEqual(
        calculateOrderPricing({
          itemsSubtotal: 12,
          deliveryFee: 8,
          tipPercentage: 0,
          discountType: "DELIVERY_PERCENT",
          discountValue: 50,
        }),
        {
          itemsSubtotal: 12,
          itemsDiscountAmount: null,
          discountedItemsSubtotal: null,
          deliveryFee: 8,
          deliveryDiscountAmount: 4,
          discountedDeliveryFee: 4,
          tipPercentage: null,
          tipAmount: null,
          chargedTotal: 16,
          vatRate: 20,
          includedVatAmount: 2.67,
        },
      );
    });

    it("caps fixed delivery discounts at the delivery fee", () => {
      assert.deepStrictEqual(
        calculateOrderPricing({
          itemsSubtotal: 10,
          deliveryFee: 2.5,
          tipPercentage: 0,
          discountType: "DELIVERY_FIXED",
          discountValue: 9,
        }),
        {
          itemsSubtotal: 10,
          itemsDiscountAmount: null,
          discountedItemsSubtotal: null,
          deliveryFee: 2.5,
          deliveryDiscountAmount: 2.5,
          discountedDeliveryFee: 0,
          tipPercentage: null,
          tipAmount: null,
          chargedTotal: 10,
          vatRate: 20,
          includedVatAmount: 1.67,
        },
      );
    });

    it("rounds percent-based discounts through cents", () => {
      assert.deepStrictEqual(
        calculateOrderPricing({
          itemsSubtotal: 19.99,
          deliveryFee: 4.99,
          tipPercentage: 0,
          discountType: "ITEMS_PERCENT",
          discountValue: 10,
        }),
        {
          itemsSubtotal: 19.99,
          itemsDiscountAmount: 2,
          discountedItemsSubtotal: 17.99,
          deliveryFee: 4.99,
          deliveryDiscountAmount: null,
          discountedDeliveryFee: null,
          tipPercentage: null,
          tipAmount: null,
          chargedTotal: 22.98,
          vatRate: 20,
          includedVatAmount: 3.83,
        },
      );
    });

    it("calculates tip from discounted items subtotal", () => {
      assert.deepStrictEqual(
        calculateOrderPricing({
          itemsSubtotal: 20,
          deliveryFee: 5,
          tipPercentage: 10,
          discountType: "ITEMS_PERCENT",
          discountValue: 25,
        }),
        {
          itemsSubtotal: 20,
          itemsDiscountAmount: 5,
          discountedItemsSubtotal: 15,
          deliveryFee: 5,
          deliveryDiscountAmount: null,
          discountedDeliveryFee: null,
          tipPercentage: 10,
          tipAmount: 1.5,
          chargedTotal: 21.5,
          vatRate: 20,
          includedVatAmount: 3.33,
        },
      );
    });
  });
});
