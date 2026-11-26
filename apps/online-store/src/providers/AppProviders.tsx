"use client";

import { type ReactNode, Suspense } from "react";

import { UtmTracker } from "@/components/layout/UtmTracker";
import { CartProvider } from "@/hooks/useCart";
import { ApiClientProvider } from "@/providers/ApiClientProvider";
import { QueryProvider } from "@/providers/QueryProvider";

import AuthProvider from "./AuthProvider";
import { PreferredLocaleSync } from "./PreferredLocaleSync";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ApiClientProvider>
          <Suspense fallback={null}>
            <PreferredLocaleSync />
          </Suspense>
          <CartProvider>
            {children}
            <UtmTracker />
          </CartProvider>
        </ApiClientProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
