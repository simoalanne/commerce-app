import "server-only";
import type { Metadata } from "next";
import type { Messages } from "next-intl";

import { getServerTranslations } from "@/i18n/serverTranslations";
import type { DestructuredRouteParams, RouteParams } from "@/types";

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export async function generateNoIndexMetadata(
  titleKey: keyof Messages["metadata"]["noIndex"],
  params: DestructuredRouteParams,
): Promise<Metadata> {
  const t = await getServerTranslations(params, "metadata.noIndex");

  return {
    ...noIndexMetadata,
    title: t(titleKey),
  };
}

const createNoIndexMetadata =
  (titleKey: keyof Messages["metadata"]["noIndex"]) =>
  async ({ params }: RouteParams) => {
    return generateNoIndexMetadata(titleKey, params);
  };

export const generateAccountAreaMetadata = createNoIndexMetadata("accountAreaTitle");

export const generateAccountDetailsMetadata = createNoIndexMetadata("accountDetailsTitle");

export const generateSavedAddressesMetadata = createNoIndexMetadata("savedAddressesTitle");

export const generateOrderHistoryMetadata = createNoIndexMetadata("orderHistoryTitle");

export const generatePaymentMetadata = createNoIndexMetadata("paymentTitle");

export const generatePaymentSuccessMetadata = createNoIndexMetadata("paymentSuccessTitle");

export const generateCartMetadata = createNoIndexMetadata("cartTitle");

export const generateOrderReviewMetadata = createNoIndexMetadata("orderReviewTitle");
