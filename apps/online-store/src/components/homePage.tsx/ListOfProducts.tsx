"use client";

import { useMemo } from "react";

import Carousel from "@/components/carousel/Carousel";
import { useStorefrontContext } from "@/providers/StorefrontContextProvider";
import type { ProductSummary } from "@/types/api";

import ProductCard from "./ProductCard";

import styles from "./ListOfProducts.module.css";

type ProductListLayout = "grid" | "carousel";
type ProductCardVariant = "detailed" | "minimal";

interface ProductProps {
  products: ProductSummary[];
  layout?: ProductListLayout;
  cardVariant?: ProductCardVariant;
  favoriteAction?: "toggle" | "remove";
  headingLevel?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div";
}

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function ListOfProducts({
  products,
  layout = "grid",
  cardVariant = "detailed",
  favoriteAction = "toggle",
  headingLevel,
}: ProductProps) {
  const storefrontContext = useStorefrontContext();
  const vendorById = useMemo(() => {
    const vendors = storefrontContext.vendors;
    return new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  }, [storefrontContext.vendors]);

  const vendorByProductId = useMemo(() => {
    const indexedProducts = storefrontContext.products;
    return new Map(indexedProducts.map((product) => [product.id, product.vendorId]));
  }, [storefrontContext.products]);

  const renderProductCard = (product: ProductSummary, isPriority: boolean) => {
    const vendorId = vendorByProductId.get(product.id);
    const vendorName = vendorById.get(vendorId || -1);

    return (
      <ProductCard
        product={product}
        vendorName={vendorName}
        layout={layout}
        cardVariant={cardVariant}
        favoriteAction={favoriteAction}
        isPriority={isPriority}
        headingLevel={headingLevel}
      />
    );
  };

  if (layout === "carousel") {
    return (
      <Carousel
        items={products}
        getItemKey={(product) => product.id}
        renderItem={(product) => (
          <div className={styles.carouselItem}>{renderProductCard(product, false)}</div>
        )}
      />
    );
  }

  return (
    <ul className={joinClassNames(styles.list, styles.gridLayout)}>
      {products.map((p, index) => {
        return (
          <li key={p.id} className={styles.gridItem}>
            {renderProductCard(p, index === 0)}
          </li>
        );
      })}
    </ul>
  );
}
