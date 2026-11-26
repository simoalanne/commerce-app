"use client";

import { useTranslations } from "next-intl";
import type React from "react";
import { useRef } from "react";

import { useCart } from "@/hooks/useCart";
import useFlyToCartAnimation from "@/hooks/useFlyToCartAnimation";
import type { ProductSummary } from "@/types/api";

type AddToCartProps = {
  product: ProductSummary;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode; // custom button content
  flyToCart?: boolean; // enable flying-clone animation
  imgUrl?: string | null; // image URL for animation
  disabled?: boolean; // disable the button (out of stock)
};

export default function AddToCartBtn({
  product,
  className,
  style,
  children,
  flyToCart = false,
  imgUrl,
  disabled = false,
}: AddToCartProps) {
  const t = useTranslations();
  const { addProduct } = useCart();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const animate = useFlyToCartAnimation({ flyToCart, imgUrl, product });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;
    addProduct(product);
    animate(buttonRef.current);
  };

  return (
    <button
      type="button"
      ref={buttonRef}
      className={className}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={t("addToCart")}
      style={style}
      onClick={handleClick}
    >
      {children ?? t("addToCart")}
    </button>
  );
}
