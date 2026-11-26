export const assertStock = (
  product: { current_stock: number; reserved_stock?: number } | null | undefined,
  expectedAvailableStock: number,
) => {
  expect(product, "Expected product to exist").toBeTruthy();
  expect(product && product.current_stock - (product.reserved_stock ?? 0)).toBe(
    expectedAvailableStock,
  );
};

export const assertOrderStatus = (
  order: { status: string } | null | undefined,
  expectedStatus: string,
) => {
  expect(order, "Expected order to exist").toHaveProperty("status", expectedStatus);
};
