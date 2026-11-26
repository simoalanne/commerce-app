import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { useAuth } from "@/features/auth/clerk";
import { useRouter } from "@/i18n/navigation";
import { useApiClient } from "@/providers/ApiClientProvider";
import type { VendorSummary } from "@/types/api";

export function useFavoriteVendorsList(vendors: VendorSummary[]) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { queryUtils } = useApiClient();
  const { data: favoriteVendors = [], isLoading } = useQuery(
    queryUtils.user.account.getFavoriteVendors.queryOptions({
      enabled: !!isSignedIn,
      select: (response) => response.body,
    }),
  );

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, router]);

  const favoriteVendorsById = useMemo(
    () => new Map(vendors.map((vendor) => [String(vendor.id), vendor])),
    [vendors],
  );

  const favoriteVendorList = useMemo(() => {
    return [...favoriteVendors]
      .sort((left, right) => new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime())
      .map((favorite) => favoriteVendorsById.get(String(favorite.id)))
      .filter((vendor): vendor is VendorSummary => !!vendor);
  }, [favoriteVendors, favoriteVendorsById]);

  return {
    isLoaded,
    isSignedIn,
    isLoading,
    favoriteVendorList,
  };
}
