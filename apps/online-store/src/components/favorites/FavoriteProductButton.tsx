"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useAuth } from "@/features/auth/clerk";
import { useApiClient } from "@/providers/ApiClientProvider";

import FavoriteToggleButton from "./FavoriteToggleButton";

type FavoriteProductButtonProps = {
  productId: number;
  productName: string;
  mode?: "toggle" | "remove";
  variant?: "overlay" | "inline";
  className?: string;
};

export default function FavoriteProductButton({
  productId,
  productName,
  mode = "toggle",
  variant = "overlay",
  className,
}: FavoriteProductButtonProps) {
  const t = useTranslations("productListing");
  const { queryUtils } = useApiClient();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const { data: favoriteProducts = [] } = useQuery(
    queryUtils.user.account.getFavoriteProducts.queryOptions({
      enabled: isSignedIn ?? false,
      select: (response) => response.body,
    }),
  );
  const addFavoriteProduct = useMutation(
    queryUtils.user.account.addFavoriteProduct.mutationOptions(),
  );
  const removeFavoriteProduct = useMutation(
    queryUtils.user.account.removeFavoriteProduct.mutationOptions(),
  );

  const isFavorite = favoriteProducts.some((item) => item.id === productId);

  const refreshFavorites = () =>
    queryClient.invalidateQueries({
      queryKey: queryUtils.user.account.getFavoriteProducts.queryKey(),
    });

  const handleClick = () => {
    if (!isSignedIn) return;

    if (mode === "remove") {
      removeFavoriteProduct.mutate(
        { params: { id: productId } },
        {
          onSuccess: refreshFavorites,
        },
      );
      return;
    }

    if (isFavorite) {
      removeFavoriteProduct.mutate({ params: { id: productId } }, { onSuccess: refreshFavorites });
      return;
    }

    addFavoriteProduct.mutate({ params: { id: productId } }, { onSuccess: refreshFavorites });
  };

  const isRemoveButton = mode === "remove";
  const buttonLabel = isRemoveButton
    ? t("product.removeFavorite", { productName })
    : isFavorite
      ? t("product.removeFavorite", { productName })
      : t("product.addFavorite", { productName });

  return (
    <>
      {isSignedIn ? (
        <FavoriteToggleButton
          mode={mode}
          variant={variant}
          className={className}
          isActive={isFavorite}
          ariaLabel={buttonLabel}
          isPending={mode === "remove" && removeFavoriteProduct.isPending}
          inlineLabel={
            variant === "inline"
              ? isFavorite
                ? t("product.favoriteCtaActive")
                : t("product.favoriteCta")
              : undefined
          }
          onClick={handleClick}
        />
      ) : (
        <div></div>
      )}
    </>
  );
}
