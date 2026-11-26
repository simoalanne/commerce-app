"use client";

import { createTanstackQueryUtils } from "@rest-rpc/tanstack-query";
import { useLocale } from "next-intl";
import { createContext, type ReactNode, useContext, useMemo, useRef } from "react";

import { createCustomerClient } from "@/api/client";
import { useAuth } from "@/features/auth/clerk";

type ApiClientProviderProps = {
  children: ReactNode;
};

const createProviderClient = (
  headerContext: React.RefObject<{
    getToken: () => Promise<string | null>;
    locale: string;
  }>,
) => {
  const client = createCustomerClient({
    globalHeaders: {
      authorization: async () => {
        const token = await headerContext.current.getToken();
        return token ? `Bearer ${token}` : undefined;
      },
      "accept-language": () => headerContext.current.locale,
    },
  });

  // Components use only the utils; `queryUtils.x.y.fetch()` makes direct calls.
  return { queryUtils: createTanstackQueryUtils(client) };
};

type ApiClientContextValue = ReturnType<typeof createProviderClient>;

const ApiClientContext = createContext<ApiClientContextValue | null>(null);

export function ApiClientProvider({ children }: ApiClientProviderProps) {
  const { getToken } = useAuth();
  const locale = useLocale();

  // Keep changing header inputs fresh without recreating the API client.
  // This ensures that if for some reason these inputs change without
  // the provider being re-rendered, the API client will still use the latest values.
  // in practise though these values should be stable for the lifetime of the provider,
  // so this is just for hardening against weird edge cases.
  const headerContext = useRef({ getToken, locale });
  headerContext.current = { getToken, locale };

  const value = useMemo(() => createProviderClient(headerContext), []);

  return <ApiClientContext.Provider value={value}>{children}</ApiClientContext.Provider>;
}

export function useApiClient() {
  const context = useContext(ApiClientContext);
  if (!context) {
    throw new Error("useApiClient must be used within ApiClientProvider");
  }

  return context;
}
