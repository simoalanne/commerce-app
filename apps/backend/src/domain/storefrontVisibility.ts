type ProductScopeInput = {
  productId?: number | null;
  productIds?: number[];
  skus?: string[];
  categoryId?: number | null;
  vendorId?: number | null;
};

export const activeStorefrontVendorWhere = ({ vendorId }: { vendorId?: number | null } = {}) => ({
  storefront_visibility: "ACTIVE" as const,
  ...(vendorId != null ? { id: vendorId } : {}),
});

export const activeStorefrontProductWhere = ({
  productId,
  productIds,
  skus,
  categoryId,
  vendorId,
}: ProductScopeInput = {}) => ({
  storefront_visibility: "ACTIVE" as const,
  ...(productId != null ? { id: productId } : {}),
  ...(productIds ? { id: { in: productIds } } : {}),
  ...(skus ? { sku: { in: skus } } : {}),
  ...(categoryId != null ? { category_id: categoryId } : {}),
  vendor: activeStorefrontVendorWhere({ vendorId }),
});
