// Route modules are imported at build time without an environment (contract
// extraction), so everything with side effects is imported as a type and
// provided per request by index.ts as initial context.
import { route } from "@rest-rpc/server";

import { customerApiPrefix, dashboardApiPrefix } from "#src/apiPrefixes.ts";
import type envConfig from "#src/config.ts";
import type { Db } from "#src/db/client.ts";
import type { AuthProvider } from "#src/integrations/auth/auth.provider.ts";
import type { EmailServiceProvider } from "#src/integrations/email/email.provider.ts";
import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";
import type { PaymentProviders } from "#src/integrations/payments/payment.provider.ts";
import type { SearchProvider } from "#src/integrations/search/search.provider.ts";
import type { EnqueueJob, JobQueue } from "#src/jobs/queue.ts";
import { type SupportedLocale, supportedLocales } from "#src/locales.ts";
import { requestContextStorage } from "#src/utils/requestContext.ts";

import { type AccessLevel, resolveAuthContext } from "./auth.ts";
import { Forbidden, RateLimitExceeded, Unauthorized } from "./errors.ts";
import type { RateLimitPolicy } from "./rateLimit.ts";

declare module "@rest-rpc/server" {
  interface DefaultMeta {
    access?: AccessLevel;
    rateLimit?: RateLimitPolicy;
  }
}

export type AppContext = {
  headers: Headers;
  // The database, or in the Tx builders the transaction.
  db: Db;
  config: typeof envConfig;
  auth: AuthProvider;
  payments: PaymentProviders;
  email: EmailServiceProvider;
  storage: ObjectStorageProvider;
  search: SearchProvider;
  jobQueue: JobQueue;
};

type ParsedLanguage = {
  value: string;
  q: number;
  index: number;
};

const normalizeLocale = (locale: string) => locale.trim().toLowerCase().replace(/_/g, "-");

const parseAcceptLanguage = (headerValue: string | undefined): ParsedLanguage[] => {
  if (!headerValue) return [];

  return headerValue
    .split(",")
    .map((part, index) => {
      const [rawLocale, ...params] = part.split(";");
      const value = normalizeLocale(rawLocale ?? "");
      if (!value) return null;

      const qParam = params.find((param) => param.trim().toLowerCase().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "") : 1;

      return {
        value,
        q: Number.isFinite(q) ? q : 0,
        index,
      };
    })
    .filter((entry): entry is ParsedLanguage => Boolean(entry))
    .sort((a, b) => b.q - a.q || a.index - b.index);
};

export const resolveSupportedLocale = (
  headerValue: string | string[] | undefined,
): SupportedLocale => {
  const normalizedSupported = supportedLocales.map((locale) => ({
    original: locale,
    normalized: normalizeLocale(locale),
    primary: normalizeLocale(locale).split("-")[0],
  }));

  const fallback = supportedLocales[0];
  const parsed = parseAcceptLanguage(
    Array.isArray(headerValue) ? headerValue.join(",") : headerValue,
  );

  for (const candidate of parsed) {
    if (candidate.value === "*") return fallback;

    const exact = normalizedSupported.find((locale) => locale.normalized === candidate.value);
    if (exact) return exact.original;

    const candidatePrimary = candidate.value.split("-")[0];
    const byPrimary = normalizedSupported.find((locale) => locale.primary === candidatePrimary);
    if (byPrimary) return byPrimary.original;
  }

  return fallback;
};

// authContext is resolved for every route, also public ones, where it is a
// proxy that throws on access (see resolveAuthContext).
const withContext = route
  .$context<AppContext>()
  .error(Unauthorized)
  .error(Forbidden)
  .error(RateLimitExceeded)
  .use(async ({ context, route, next }) => {
    const authContext = await resolveAuthContext(context, route.meta?.access ?? null);
    // Read by the error handler to tag Sentry events with the user.
    const requestContext = requestContextStorage.getStore();
    if (requestContext) requestContext.authContext = authContext;

    return next({
      context: {
        authContext,
        locale: resolveSupportedLocale(context.headers.get("accept-language") ?? undefined),
      },
    });
  });

export const customerRoute = withContext.prefix(customerApiPrefix);

export const dashboardRoute = withContext.prefix(dashboardApiPrefix);

// The handler runs in one transaction: context.db is the transaction, and
// context.enqueueJob writes jobs that become visible on commit. Use these for
// writes; use the plain builders for reads and for routes that call external
// services, which must not hold a transaction open.
const withTransaction = withContext.use(({ context, next }) =>
  context.db.transaction((tx) => {
    const enqueueJob: EnqueueJob = (job) => context.jobQueue.enqueue(tx, job);
    return next({ context: { db: tx, enqueueJob } });
  }),
);

export const customerTxRoute = withTransaction.prefix(customerApiPrefix);

export const dashboardTxRoute = withTransaction.prefix(dashboardApiPrefix);
