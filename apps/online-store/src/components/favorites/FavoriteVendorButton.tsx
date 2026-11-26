"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type React from "react";

import { useAuth } from "@/features/auth/clerk";
import { useApiClient } from "@/providers/ApiClientProvider";

import FavoriteToggleButton from "./FavoriteToggleButton";

type FavoriteVendorButtonProps = {
  vendorId: string;
  vendorName: string;
  mode?: "toggle" | "remove";
  variant?: "overlay" | "inline";
  className?: string;
};

export default function FavoriteVendorButton({
  vendorId,
  vendorName,
  mode = "toggle",
  variant = "overlay",
  className,
}: FavoriteVendorButtonProps) {
  const t = useTranslations("vendorListing");
  const { queryUtils } = useApiClient();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const { data: favoriteVendors = [] } = useQuery(
    queryUtils.user.account.getFavoriteVendors.queryOptions({
      enabled: !!isSignedIn,
      select: (response) => response.body,
    }),
  );
  const addFavoriteVendor = useMutation(
    queryUtils.user.account.addFavoriteVendor.mutationOptions(),
  );
  const removeFavoriteVendor = useMutation(
    queryUtils.user.account.removeFavoriteVendor.mutationOptions(),
  );
  const vendorIdNumber = Number(vendorId);
  const isFavorite = favoriteVendors.some((item) => item.id === vendorIdNumber);

  const refreshFavorites = () =>
    queryClient.invalidateQueries({
      queryKey: queryUtils.user.account.getFavoriteVendors.queryKey(),
    });

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isSignedIn) return;

    if (mode === "remove") {
      removeFavoriteVendor.mutate(
        { params: { id: vendorIdNumber } },
        {
          onSuccess: refreshFavorites,
        },
      );
      return;
    }

    if (isFavorite) {
      removeFavoriteVendor.mutate(
        { params: { id: vendorIdNumber } },
        { onSuccess: refreshFavorites },
      );
      return;
    }

    addFavoriteVendor.mutate({ params: { id: vendorIdNumber } }, { onSuccess: refreshFavorites });
  };

  const ariaLabel =
    mode === "remove"
      ? t("vendor.removeFavorite", { vendorName })
      : isFavorite
        ? t("vendor.removeFavorite", { vendorName })
        : t("vendor.addFavorite", { vendorName });

  if (!isSignedIn) {
    return null;
  }

  return (
    <FavoriteToggleButton
      mode={mode}
      variant={variant}
      className={className}
      isActive={isFavorite}
      ariaLabel={ariaLabel}
      isPending={mode === "remove" && removeFavoriteVendor.isPending}
      inlineLabel={
        variant === "inline"
          ? isFavorite
            ? t("vendor.favoriteCtaActive")
            : t("vendor.favoriteCta")
          : undefined
      }
      onClick={handleClick}
    />
  );
}
