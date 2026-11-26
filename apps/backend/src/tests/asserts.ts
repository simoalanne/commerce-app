export const assertStock = (
  product: { currentStock: number; reservedStock?: number } | null | undefined,
  expectedAvailableStock: number,
) => {
  expect(product, "Expected product to exist").toBeTruthy();
  expect(product && product.currentStock - (product.reservedStock ?? 0)).toBe(
    expectedAvailableStock,
  );
};

export const assertOrderStatus = (
  order: { status: string } | null | undefined,
  expectedStatus: string,
) => {
  expect(order, "Expected order to exist").toHaveProperty("status", expectedStatus);
};
