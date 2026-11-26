import { useAuth, useClerk } from "@clerk/react";
import { clientInterceptor, createClient, type InferClientResponse } from "@rest-rpc/core";
import { createTanstackQueryUtils } from "@rest-rpc/tanstack-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Relative with extension: unplugin-macros resolves macros with Node, without
// Vite aliases or extension resolution.
import { getContract } from "../api/contract.ts" with { type: "macro" };
import { useDashboardLocalization } from "./LocalizationContext";

const origin = import.meta.env.VITE_API_URL;

if (!origin) {
  throw new Error("Missing VITE_API_URL");
}

// Set by ApiClientProvider from Clerk and the localization context, which only
// exist inside React. The client reads them for each request.
let getAuthorization: () => Promise<string | undefined> = async () => undefined;
let contentLocale: string | undefined;
let onAuthError: (() => Promise<void>) | undefined;

const signOutOn401Or403 = clientInterceptor(async ({ next }) => {
  const response = await next();
  // TODO: only react this aggressively if where this error occured was a mutation.
  // queries should just go through and UI should handle them as they come. mutation
  // failing is a clear sign that user doesn't have access to do what they are
  // trying to do and we should react to it immediately.
  // also any other frontend doing this same logic should be refactored to
  // do the same so we have consistent handling of auth errors across the board.
  if (response.status === 401 || response.status === 403) void onAuthError?.();
  return response;
});

const client = createClient(getContract(), {
  origin,
  globalHeaders: {
    authorization: () => getAuthorization(),
    "accept-language": () => contentLocale,
  },
  interceptors: [signOutOn401Or403],
});

export const queryUtils = createTanstackQueryUtils(client);

type DashboardSession = InferClientResponse<typeof queryUtils.auth.getSession.fetch>["body"];

const DashboardSessionContext = createContext<{
  dashboardSession: DashboardSession | undefined;
  isSessionResolved: boolean;
} | null>(null);

function DashboardModeProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { data: dashboardSession, isSuccess: isSessionResolved } = useQuery(
    queryUtils.auth.getSession.queryOptions({
      select: (r) => r.body,
      enabled: isLoaded && isSignedIn,
    }),
  );

  return (
    <DashboardSessionContext.Provider value={{ dashboardSession, isSessionResolved }}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

function ApiClientProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { contentLocale: locale } = useDashboardLocalization();

  getAuthorization = async () => {
    const token = await getToken();
    return token ? `Bearer ${token}` : undefined;
  };
  contentLocale = locale;

  useEffect(() => {
    if (!isSignedIn) {
      queryClient.clear();
    }
  }, [isSignedIn, queryClient]);

  useEffect(() => {
    onAuthError = async () => {
      if (location.pathname === "/login") return;

      queryClient.clear();
      await signOut();
      navigate("/login", { replace: true });
    };
  }, [location.pathname, navigate, queryClient, signOut]);

  return <DashboardModeProvider>{children}</DashboardModeProvider>;
}

const useDashboardSession = () => {
  const context = useContext(DashboardSessionContext);
  if (!context) {
    throw new Error("useDashboardSession must be used within ApiClientProvider");
  }
  return context;
};

export default ApiClientProvider;
export { useDashboardSession };
