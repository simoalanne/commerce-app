import assert from "node:assert";

export const assertStock = (
  product: { current_stock: number; reserved_stock?: number } | null | undefined,
  expectedAvailableStock: number,
) => {
  assert.ok(product, "Expected product to exist");
  assert.equal(product.current_stock - (product.reserved_stock ?? 0), expectedAvailableStock);
};

export const assertOrderStatus = (
  order: { status: string } | null | undefined,
  expectedStatus: string,
) => {
  assert.ok(order, "Expected order to exist");
  assert.equal(order.status, expectedStatus);
};
