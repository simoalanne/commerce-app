"use client";

import type { ReactNode } from "react";

import { ClerkProvider } from "@/features/auth/clerk";

export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/" prefetchUI={false}>
      {children}
    </ClerkProvider>
  );
}
