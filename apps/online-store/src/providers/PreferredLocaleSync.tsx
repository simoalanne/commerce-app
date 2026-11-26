"use client";

import { safe } from "@rest-rpc/core";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/clerk";
import { usePathname, useRouter } from "@/i18n/navigation";
import { getValidLocale } from "@/i18n/routing";
import { useApiClient } from "@/providers/ApiClientProvider";

const getLocaleSyncKey = (sessionId: string) => `preferred-locale-synced:${sessionId}`;

export function PreferredLocaleSync() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const { queryUtils } = useApiClient();
  const currentLocale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return;

    const syncKey = getLocaleSyncKey(sessionId);

    if (sessionStorage.getItem(syncKey)) return;

    let cancelled = false;

    void safe(queryUtils.user.account.getPreferences.fetch()).then(({ error, data }) => {
      if (cancelled || error || !data) return;

      sessionStorage.setItem(syncKey, "true");

      const preferredLocale = getValidLocale(data.body.preferredLocale);

      if (preferredLocale === currentLocale) return;

      const query = searchParams.toString();
      const destination = query ? `${pathname}?${query}` : pathname;

      router.replace(destination, {
        locale: preferredLocale,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [queryUtils, currentLocale, isLoaded, isSignedIn, pathname, router, searchParams, sessionId]);

  return null;
}
