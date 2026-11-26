import { productsRoutes as customerProductsRoutes } from "#src/features/customer-api/products/products.routes.ts";

import { buildTag } from "./buildTags.ts";

export const buildProductStockInvalidationTags = (productIds: number[]) => [
  buildTag(customerProductsRoutes.getAll),
  ...productIds.map((productId) => buildTag(customerProductsRoutes.getById, productId)),
];
