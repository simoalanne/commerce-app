"use client";

import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo } from "react";

import ListOfProducts from "@/components/homePage.tsx/ListOfProducts";
import { useAuth } from "@/features/auth/clerk";
import { Link, useRouter } from "@/i18n/navigation";
import { useApiClient } from "@/providers/ApiClientProvider";
import type { ProductSummary } from "@/types/api";

import styles from "./FavoritesProductsStorefront.module.css";

type ProductsSectionProps = {
  title: string;
  layout?: "grid" | "carousel";
  linkHref: string;
  linkLabel: string;
  linkIcon?: ReactNode;
  products: ProductSummary[];
};

export default function FavoriteProductsSection({
  title,
  layout = "grid",
  linkHref,
  linkLabel,
  linkIcon,
  products,
}: ProductsSectionProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { queryUtils } = useApiClient();
  const { data: favoriteProducts = [], isLoading } = useQuery(
    queryUtils.user.account.getFavoriteProducts.queryOptions({
      enabled: !!isSignedIn,
      select: (response) => response.body,
    }),
  );

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, router]);

  const favoriteProductsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const favoriteProductList = useMemo(() => {
    return [...favoriteProducts]
      .sort((left, right) => new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime())
      .map((favorite) => favoriteProductsById.get(favorite.id))
      .filter((product): product is ProductSummary => !!product);
  }, [favoriteProducts, favoriteProductsById]);

  if (!isLoaded || !isSignedIn || isLoading) {
    return null;
  }

  return (
    <>
      {favoriteProductList.length === 0 ? null : (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h2>{title}</h2>
            <Link href={linkHref} className={styles.seeDirectory} prefetch={false}>
              {linkLabel} {linkIcon}
            </Link>
          </div>
          <ListOfProducts
            products={favoriteProductList}
            layout={layout}
            cardVariant="detailed"
            favoriteAction="remove"
          />
        </section>
      )}
    </>
  );
}
