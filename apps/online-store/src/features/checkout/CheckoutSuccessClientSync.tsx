"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { clearStoredUtmTracking } from "@/components/layout/UtmTracker";
import { useCart } from "@/hooks/useCart";
import { useApiClient } from "@/providers/ApiClientProvider";

import { checkoutRecoveryDraftStorageKey } from "./checkoutTypes";
import { clearActivePaytrailPayment } from "./paytrailActivePayment";

type CheckoutSuccessClientSyncProps = {
  accessToken?: string;
  shouldPoll: boolean;
};

export default function CheckoutSuccessClientSync({
  accessToken,
  shouldPoll,
}: CheckoutSuccessClientSyncProps) {
  const router = useRouter();
  const { clear, hasHydrated } = useCart();
  const { queryUtils } = useApiClient();

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    clear();
    window.localStorage.removeItem(checkoutRecoveryDraftStorageKey);
    clearActivePaytrailPayment();
    clearStoredUtmTracking();
  }, [clear, hasHydrated]);

  const { data: pollResponse } = useQuery(
    queryUtils.checkout.pollOrderStatus.queryOptions({
      request: { query: { token: accessToken ?? "" } },
      enabled: shouldPoll && !!accessToken,
      refetchInterval: (query) =>
        !(query.state.data as { body: { isPaid: boolean } } | undefined)?.body.isPaid
          ? 5000
          : false,
    }),
  );
  const pollData = pollResponse?.body;

  useEffect(() => {
    if (!pollData?.isPaid) {
      return;
    }

    router.refresh();
  }, [pollData?.isPaid, router]);

  return null;
}
