import { randomUUID } from "node:crypto";

import type envConfig from "#src/config.ts";
import logger from "#src/logger.ts";

import { calculateHmac } from "./payment.provider.paytrail.signature.ts";

type PaytrailPaymentMethodsResponse = {
  groups?: {
    id?: string;
    name?: string;
    icon?: string;
    providers?: {
      id?: string;
      name?: string;
      icon?: string;
      svg?: string;
    }[];
  }[];
  providers?: {
    id?: string;
    name?: string;
    icon?: string;
    svg?: string;
  }[];
};

type PaytrailPaymentMethod = {
  id: string;
  name: string;
  imageUrl: string;
  group: {
    id: string;
    name: string;
  } | null;
};

const cacheTtlMs = 1000 * 60 * 60 * 24;
const paymentMethodCache = {
  value: null as PaytrailPaymentMethod[] | null,
  expiresAt: 0,
  inFlight: null as Promise<PaytrailPaymentMethod[]> | null,
};

type Config = typeof envConfig;

const buildHeaders = (config: Config, method: "GET" | "POST", body: string) => {
  const currentDate = new Date().toISOString();
  const headers: Record<string, string | number> = {
    "checkout-account": config.PAYTRAIL_MERCHANT_ID ?? "",
    "checkout-algorithm": "sha256",
    "checkout-method": method,
    "checkout-nonce": randomUUID(),
    "checkout-timestamp": currentDate,
  };
  headers.signature = calculateHmac(config.PAYTRAIL_SECRET_KEY ?? "", headers, body);
  headers["platform-name"] = config.PAYTRAIL_MERCHANT_NAME ?? "";
  return headers;
};

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const normalizePaymentMethods = (payload: PaytrailPaymentMethodsResponse) => {
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const groupedProviders = groups.flatMap((group) => {
    const groupId = group.id ?? "unknown";
    const groupName = group.name ?? "Other";
    const providers = Array.isArray(group.providers) ? group.providers : [];

    return providers.flatMap((provider, index) => {
      const imageUrl = provider.svg ?? provider.icon ?? group.icon;
      if (!imageUrl || !isHttpsUrl(imageUrl)) return [];

      const id = provider.id ?? provider.name ?? `${groupId}-${index}`;
      const name = provider.name ?? provider.id ?? "Payment method";

      return [
        {
          id,
          name,
          imageUrl,
          group: {
            id: groupId,
            name: groupName,
          },
        },
      ];
    });
  });

  if (groupedProviders.length > 0) return groupedProviders;

  const providers = Array.isArray(payload.providers) ? payload.providers : [];
  return providers.flatMap((provider, index) => {
    const imageUrl = provider.svg ?? provider.icon;
    if (!imageUrl || !isHttpsUrl(imageUrl)) return [];

    const id = provider.id ?? provider.name ?? `provider-${index}`;
    const name = provider.name ?? provider.id ?? "Payment method";

    return [
      {
        id,
        name,
        imageUrl,
        group: null,
      },
    ];
  });
};

const paymentMethodsUrls = [
  "https://services.paytrail.com/merchants/grouped-payment-providers",
  "https://services.paytrail.com/merchants/payment-providers",
];

const fetchPaytrailResponse = async (config: Config, url: string, body: string) => {
  const response = await fetch(url, {
    method: "GET",
    headers: Object.fromEntries(
      Object.entries(buildHeaders(config, "GET", body)).map(([key, value]) => [key, String(value)]),
    ),
  });

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      body: await response.text(),
    };
  }

  return {
    ok: true as const,
    payload: (await response.json()) as PaytrailPaymentMethodsResponse,
  };
};

const fetchPaymentMethods = async (config: Config) => {
  const body = "";
  let lastErrorBody = "";
  let lastStatus = 0;

  for (const url of paymentMethodsUrls) {
    const result = await fetchPaytrailResponse(config, url, body);

    if (result.ok) return normalizePaymentMethods(result.payload);

    lastStatus = result.status;
    lastErrorBody = result.body;
    if (result.status !== 404) break;
  }

  logger.error(
    `Failed to fetch Paytrail payment methods. Status: ${lastStatus}, Body: ${lastErrorBody}`,
  );
  throw new Error("PAYTRAIL_PAYMENT_METHODS_FAILED");
};

export const getCachedPaytrailPaymentMethods = async (config: Config) => {
  const canUsePaytrail =
    !!config.PAYTRAIL_MERCHANT_ID &&
    !!config.PAYTRAIL_SECRET_KEY &&
    !!config.PAYTRAIL_MERCHANT_NAME;
  if (!canUsePaytrail) return [];
  if (paymentMethodCache.value && paymentMethodCache.expiresAt > Date.now()) {
    return paymentMethodCache.value;
  }
  if (paymentMethodCache.inFlight) return paymentMethodCache.inFlight;

  paymentMethodCache.inFlight = fetchPaymentMethods(config)
    .then((methods) => {
      paymentMethodCache.value = methods;
      paymentMethodCache.expiresAt = Date.now() + cacheTtlMs;
      return methods;
    })
    .catch((error) => {
      logger.error("Paytrail payment methods cache refresh failed", error);
      return paymentMethodCache.value ?? [];
    })
    .finally(() => {
      paymentMethodCache.inFlight = null;
    });

  return paymentMethodCache.inFlight;
};
