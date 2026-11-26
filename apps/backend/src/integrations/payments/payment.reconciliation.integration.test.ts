import assert from "node:assert";
import { afterEach, describe, it } from "node:test";

import prismaClient from "#src/prisma.ts";
import { assertOrderStatus, assertStock } from "#src/tests/asserts.ts";
import {
  createCategory,
  createCustomerAccount,
  createOrder,
  createVendor,
  createProduct,
} from "#src/tests/factories.ts";

import { reconcileOrder } from "./payment.reconciliation.ts";

const createdCategoryIds = new Set<number>();
const createdOrderIds = new Set<number>();
const createdVendorIds = new Set<number>();
const createdProductSkus = new Set<string>();
const createdUserIds = new Set<string>();

afterEach(async () => {
  if (createdOrderIds.size > 0) {
    await prismaClient.order.deleteMany({
      where: { id: { in: [...createdOrderIds] } },
    });
    createdOrderIds.clear();
  }

  if (createdProductSkus.size > 0) {
    await prismaClient.product.deleteMany({
      where: { sku: { in: [...createdProductSkus] } },
    });
    createdProductSkus.clear();
  }

  if (createdVendorIds.size > 0) {
    await prismaClient.vendor.deleteMany({
      where: { id: { in: [...createdVendorIds] } },
    });
    createdVendorIds.clear();
  }

  if (createdCategoryIds.size > 0) {
    await prismaClient.category.deleteMany({
      where: { id: { in: [...createdCategoryIds] } },
    });
    createdCategoryIds.clear();
  }

  if (createdUserIds.size > 0) {
    await prismaClient.user.deleteMany({
      where: { clerk_id: { in: [...createdUserIds] } },
    });
    createdUserIds.clear();
  }
});

const createReconciliationScenario = async ({
  provider = "STRIPE",
  orderStatus = "PENDING",
  currentStock = 10,
  reservedStock = 2,
  quantity = 2,
}: {
  provider?: "STRIPE" | "PAYTRAIL";
  orderStatus?: "PENDING" | "PAID" | "EXPIRED" | "AWAITING_REFUND" | "DELIVERED";
  currentStock?: number;
  reservedStock?: number;
  quantity?: number;
} = {}) => {
  const category = await createCategory();
  createdCategoryIds.add(category.id);

  const vendor = await createVendor();
  createdVendorIds.add(vendor.id);

  const customer = await createCustomerAccount();
  createdUserIds.add(customer.user_id);

  const product = await createProduct({
    category_id: category.id,
    vendor_id: vendor.id,
    current_stock: currentStock,
    reserved_stock: reservedStock,
    cost_price: 9.9,
    sales_price: 9.9,
  });
  createdProductSkus.add(product.sku);

  const order = await createOrder({
    customer_id: customer.id,
    items_subtotal: 19.8,
    charged_total: 19.8,
    status: orderStatus,
    payment_id: null,
    payment_provider: provider,
    order_details: {
      items: [{ sku: product.sku, quantity, unitPrice: 9.9 }],
      customer: {
        name: "Webhook Customer",
        email: "customer@example.com",
        phone: "+1555401112224",
      },
      delivery: {
        addressLabel: "1 Webhook Street, 10001 Springfield",
        city: "Springfield",
        instructions: {},
      },
    },
    order_items: {
      create: [
        {
          sku: product.sku,
          name: product.name.en,
          quantity,
          unit_cost_price: product.cost_price,
          unit_sales_price: 9.9,
          product_id: product.id,
          vendor_id: vendor.id,
          vendor_name: vendor.name,
        },
      ],
    },
  });
  createdOrderIds.add(order.id);

  return { order, product };
};

describe("payment reconciliation integration", () => {
  it("marks a pending Stripe order as paid, commits stock, and exits idempotently on repeat", async () => {
    const { order, product } = await createReconciliationScenario();

    const first = await reconcileOrder({
      provider: "STRIPE",
      orderId: order.id,
      paymentId: "pi_paid_1",
      result: "paid",
    });
    const second = await reconcileOrder({
      provider: "STRIPE",
      orderId: order.id,
      paymentId: "pi_paid_1",
      result: "paid",
    });

    const updatedOrder = await prismaClient.order.findUnique({
      where: { id: order.id },
    });
    const updatedProduct = await prismaClient.product.findUnique({
      where: { sku: product.sku },
    });

    assert.ok(first, "Expected first reconciliation to update the order");
    assert.strictEqual(second, null);
    assertOrderStatus(updatedOrder, "PAID");
    assertStock(updatedProduct, 8);
    assert.strictEqual(updatedProduct?.reserved_stock, 0);
  });

  it("recovers a late-paid order after expiry when stock is still available", async () => {
    const { order, product } = await createReconciliationScenario({
      provider: "PAYTRAIL",
      orderStatus: "EXPIRED",
      currentStock: 10,
      reservedStock: 0,
    });

    const result = await reconcileOrder({
      provider: "PAYTRAIL",
      orderId: order.id,
      paymentId: "pt_paid_1",
      result: "paid",
    });

    const updatedOrder = await prismaClient.order.findUnique({
      where: { id: order.id },
    });
    const updatedProduct = await prismaClient.product.findUnique({
      where: { sku: product.sku },
    });

    assert.ok(result, "Expected late payment to recover the order");
    assertOrderStatus(updatedOrder, "PAID");
    assert.strictEqual(updatedOrder?.payment_id, "pt_paid_1");
    assertStock(updatedProduct, 8);
    assert.strictEqual(updatedProduct?.reserved_stock, 0);
  });

  it("marks a pending Paytrail order as expired and releases stock on cancel callback", async () => {
    const { order, product } = await createReconciliationScenario({
      provider: "PAYTRAIL",
    });

    const first = await reconcileOrder({
      provider: "PAYTRAIL",
      orderId: order.id,
      paymentId: "pt_canceled_1",
      result: "canceled",
    });
    const second = await reconcileOrder({
      provider: "PAYTRAIL",
      orderId: order.id,
      paymentId: "pt_canceled_1",
      result: "canceled",
    });

    const updatedOrder = await prismaClient.order.findUnique({
      where: { id: order.id },
    });
    const updatedProduct = await prismaClient.product.findUnique({
      where: { sku: product.sku },
    });

    assert.ok(first, "Expected cancel reconciliation to expire the order");
    assert.strictEqual(second, null);
    assertOrderStatus(updatedOrder, "EXPIRED");
    assert.strictEqual(updatedOrder?.payment_id, "pt_canceled_1");
    assertStock(updatedProduct, 10);
    assert.strictEqual(updatedProduct?.reserved_stock, 0);
  });

  it("recovers a late-paid order and records uncommitted quantity when stock is short", async () => {
    const { order, product } = await createReconciliationScenario({
      provider: "PAYTRAIL",
      orderStatus: "EXPIRED",
      currentStock: 1,
      reservedStock: 0,
      quantity: 2,
    });

    const result = await reconcileOrder({
      provider: "PAYTRAIL",
      orderId: order.id,
      paymentId: "pt_paid_2",
      result: "paid",
    });

    const updatedOrder = await prismaClient.order.findUnique({
      where: { id: order.id },
    });
    const updatedProduct = await prismaClient.product.findUnique({
      where: { sku: product.sku },
    });
    const updatedOrderItem = await prismaClient.orderItem.findFirstOrThrow({
      where: { order_id: order.id },
    });

    assert.ok(result, "Expected late payment to recover the order");
    assertOrderStatus(updatedOrder, "PAID");
    assert.strictEqual(updatedOrder?.payment_id, "pt_paid_2");
    assertStock(updatedProduct, 0);
    assert.strictEqual(updatedProduct?.reserved_stock, 0);
    assert.strictEqual(updatedOrderItem.uncommitted_quantity, 1);
  });

  it("returns null when the order does not exist", async () => {
    const result = await reconcileOrder({
      provider: "STRIPE",
      orderId: 99999999,
      paymentId: "pi_missing",
      result: "paid",
    });

    assert.strictEqual(result, null);
  });
});
