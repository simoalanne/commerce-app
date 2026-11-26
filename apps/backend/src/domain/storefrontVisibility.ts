import { and, eq } from "drizzle-orm";

import { productTable, vendorTable } from "#src/db/schema.ts";

type ProductScopeInput = {
  productId?: number | null;
  productIds?: number[];
  skus?: string[];
  categoryId?: number | null;
  vendorId?: number | null;
};

export const activeStorefrontVendorWhere = ({ vendorId }: { vendorId?: number | null } = {}) => ({
  storefrontVisibility: "ACTIVE" as const,
  ...(vendorId != null ? { id: vendorId } : {}),
});

export const activeStorefrontProductWhere = ({
  productId,
  productIds,
  skus,
  categoryId,
  vendorId,
}: ProductScopeInput = {}) => ({
  storefrontVisibility: "ACTIVE" as const,
  ...(productId != null ? { id: productId } : {}),
  ...(productIds ? { id: { in: productIds } } : {}),
  ...(skus ? { sku: { in: skus } } : {}),
  ...(categoryId != null ? { categoryId } : {}),
  vendor: activeStorefrontVendorWhere({ vendorId }),
});

/** The same rule for core queries that join product and vendor. */
export const activeStorefrontProductAndVendor = () =>
  and(
    eq(productTable.storefrontVisibility, "ACTIVE"),
    eq(vendorTable.storefrontVisibility, "ACTIVE"),
  );
