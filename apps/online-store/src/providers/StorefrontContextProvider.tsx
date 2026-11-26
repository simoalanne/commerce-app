"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { StorefrontContext } from "@/types/api";

const StorefrontContextValue = createContext<StorefrontContext | null>(null);

type StorefrontContextProviderProps = {
  children: ReactNode;
  value: StorefrontContext;
};

export function StorefrontContextProvider({ children, value }: StorefrontContextProviderProps) {
  return (
    <StorefrontContextValue.Provider value={value}>{children}</StorefrontContextValue.Provider>
  );
}

export function useStorefrontContext() {
  const storefrontContext = useContext(StorefrontContextValue);

  if (!storefrontContext) {
    throw new Error("useStorefrontContext must be used within StorefrontContextProvider");
  }

  return storefrontContext;
}
