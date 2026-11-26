"use client";

import * as Sentry from "@sentry/nextjs";
import { type ReactNode, useEffect } from "react";

import { ClerkProvider, useUser } from "@/features/auth/clerk";

function SentrySync() {
  const { user, isLoaded } = useUser();
  useEffect(() => {
    if (!isLoaded) return;
    Sentry.setUser(user ? { id: user.id } : null);
  }, [user, isLoaded]);
  return null;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/" prefetchUI={false}>
      <SentrySync />
      {children}
    </ClerkProvider>
  );
}
