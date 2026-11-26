import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";

import "./index.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ApiClientProvider from "@/context/ApiClientContext.tsx";
import { LocalizationProvider } from "@/context/LocalizationContext.tsx";

import App from "./App.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      // Revalidate when a page remounts so cross-page navigation does not
      // depend entirely on perfect manual invalidation coverage.
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function AppProviders() {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/login"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LocalizationProvider>
            <ApiClientProvider>
              <App />
              <Toaster />
            </ApiClientProvider>
          </LocalizationProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders />
    </BrowserRouter>
  </StrictMode>,
);
