import { inArray } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import { categoryTable, orderTable, productTable, userTable, vendorTable } from "#src/db/schema.ts";
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
    await db.delete(orderTable).where(inArray(orderTable.id, [...createdOrderIds]));
    createdOrderIds.clear();
  }

  if (createdProductSkus.size > 0) {
    await db.delete(productTable).where(inArray(productTable.sku, [...createdProductSkus]));
    createdProductSkus.clear();
  }

  if (createdVendorIds.size > 0) {
    await db.delete(vendorTable).where(inArray(vendorTable.id, [...createdVendorIds]));
    createdVendorIds.clear();
  }

  if (createdCategoryIds.size > 0) {
    await db.delete(categoryTable).where(inArray(categoryTable.id, [...createdCategoryIds]));
    createdCategoryIds.clear();
  }

  if (createdUserIds.size > 0) {
    await db.delete(userTable).where(inArray(userTable.clerkId, [...createdUserIds]));
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
  orderStatus?: "PENDING" | "PAID" | "EXPIRED" | "DELIVERED";
  currentStock?: number;
  reservedStock?: number;
  quantity?: number;
} = {}) => {
  const category = await createCategory();
  createdCategoryIds.add(category.id);

  const vendor = await createVendor();
  createdVendorIds.add(vendor.id);

  const customer = await createCustomerAccount();
  createdUserIds.add(customer.userId);

  const product = await createProduct({
    categoryId: category.id,
    vendorId: vendor.id,
    currentStock,
    reservedStock,
    costPriceCents: 990,
    salesPriceCents: 990,
  });
  createdProductSkus.add(product.sku);

  const order = await createOrder({
    customerId: customer.id,
    itemsSubtotalCents: 1980,
    chargedTotalCents: 1980,
    status: orderStatus,
    paymentId: null,
    paymentProvider: provider,
    orderDetails: {
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
    orderItems: [
      {
        sku: product.sku,
        name: product.name.en ?? "",
        quantity,
        unitCostPriceCents: product.costPriceCents,
        unitSalesPriceCents: 990,
        productId: product.id,
        vendorId: vendor.id,
        vendorName: vendor.name,
      },
    ],
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

    const updatedOrder = await db.query.order.findFirst({
      where: { id: order.id },
    });
    const updatedProduct = await db.query.product.findFirst({
      where: { sku: product.sku },
    });

    expect(first, "Expected first reconciliation to update the order").toBeTruthy();
    expect(second).toBe(null);
    assertOrderStatus(updatedOrder, "PAID");
    assertStock(updatedProduct, 8);
    expect(updatedProduct?.reservedStock).toBe(0);
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

    const updatedOrder = await db.query.order.findFirst({
      where: { id: order.id },
    });
    const updatedProduct = await db.query.product.findFirst({
      where: { sku: product.sku },
    });

    expect(result, "Expected late payment to recover the order").toBeTruthy();
    assertOrderStatus(updatedOrder, "PAID");
    expect(updatedOrder?.paymentId).toBe("pt_paid_1");
    assertStock(updatedProduct, 8);
    expect(updatedProduct?.reservedStock).toBe(0);
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

    const updatedOrder = await db.query.order.findFirst({
      where: { id: order.id },
    });
    const updatedProduct = await db.query.product.findFirst({
      where: { sku: product.sku },
    });

    expect(first, "Expected cancel reconciliation to expire the order").toBeTruthy();
    expect(second).toBe(null);
    assertOrderStatus(updatedOrder, "EXPIRED");
    expect(updatedOrder?.paymentId).toBe("pt_canceled_1");
    assertStock(updatedProduct, 10);
    expect(updatedProduct?.reservedStock).toBe(0);
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

    const updatedOrder = await db.query.order.findFirst({
      where: { id: order.id },
    });
    const updatedProduct = await db.query.product.findFirst({
      where: { sku: product.sku },
    });
    const updatedOrderItem = await db.query.orderItem.findFirst({
      where: { orderId: order.id },
    });
    if (!updatedOrderItem) throw new Error("updatedOrderItem not found");

    expect(result, "Expected late payment to recover the order").toBeTruthy();
    assertOrderStatus(updatedOrder, "PAID");
    expect(updatedOrder?.paymentId).toBe("pt_paid_2");
    assertStock(updatedProduct, 0);
    expect(updatedProduct?.reservedStock).toBe(0);
    expect(updatedOrderItem.uncommittedQuantity).toBe(1);
  });

  it("returns null when the order does not exist", async () => {
    const result = await reconcileOrder({
      provider: "STRIPE",
      orderId: 99999999,
      paymentId: "pi_missing",
      result: "paid",
    });

    expect(result).toBe(null);
  });
});
