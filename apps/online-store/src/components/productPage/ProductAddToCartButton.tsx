"use client";

import AddToCartBtn from "@/components/productPage/AddToCartBtn";
import { getProductMaxOrderQuantity } from "@/features/checkout/cartState";
import { useCart } from "@/hooks/useCart";
import type { ProductSummary } from "@/types/api";

type ProductAddToCartButtonProps = {
  product: ProductSummary;
  className?: string;
  flyToCart?: boolean;
  imgUrl?: string | null;
};

export default function ProductAddToCartButton({
  product,
  className,
  flyToCart,
  imgUrl,
}: ProductAddToCartButtonProps) {
  const { items } = useCart();

  const currentQuantity = items[product.sku]?.quantity ?? 0;
  const maxQuantityReached = currentQuantity >= getProductMaxOrderQuantity(product);
  const noAvailableProduct = product.isOutOfStock || maxQuantityReached;

  return (
    <AddToCartBtn
      product={product}
      className={className}
      flyToCart={flyToCart}
      imgUrl={imgUrl}
      disabled={noAvailableProduct}
    />
  );
}
