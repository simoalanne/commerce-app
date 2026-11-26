"use client";

import { RouteError } from "@rest-rpc/core";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import styles from "./async-boundary.module.css";

type AsyncBoundaryProps = {
  children: ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode | ((props: FallbackProps) => ReactNode);
};

const isNotFoundError = (error: unknown) => error instanceof RouteError && error.status === 404;

/**
 * Client-side async boundary for React Query + Suspense content.
 * Use this for **Client Components** that fetch data with `useSuspenseQuery()` and
 * should keep the surrounding page shell visible while only the async region
 * shows loading or error UI.
 *
 * Compared to relying on Next.js app router `loading.tsx` / `error.tsx` instead, this component has following advantages:
 * - Loading and error states are scoped to the async region, so the rest of the page remains visible and interactive.
 * - User can retry failed queries without the whole page reloading, preserving the current state of the page.
 *
 * Code example:
 *
 * ```tsx
 * "use client";
 *
 * import { AsyncBoundary } from "@/components/async-boundary";
 * import { useSuspenseQuery } from "@tanstack/react-query";
 * import { useApiClient } from "@/providers/ApiClientProvider";
 *
 * export default function AccountOrdersPage() {
 *   return (
 *     <AsyncBoundary>
 *       <AccountOrdersContent />
 *     </AsyncBoundary>
 *   );
 * }
 *
 * function AccountOrdersContent() {
 *   const { queryUtils } = useApiClient();
 *   // No error handling or loading state needed here, AsyncBoundary will take care of it
 *   const { data } = useSuspenseQuery(
 *     queryUtils.orders.list.queryOptions({ select: (r) => r.body }),
 *   );
 *
 *   return <div>{data.length} orders</div>;
 * }
 * ```
 */
function ErrorBoundaryWithParams({
  children,
  loadingFallback,
  errorFallback,
  reset,
}: AsyncBoundaryProps & { reset: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();

  return (
    <ErrorBoundary
      onReset={reset}
      resetKeys={[pathname, serializedSearchParams]}
      fallbackRender={(props) => <ResolvedErrorFallback errorFallback={errorFallback} {...props} />}
    >
      <Suspense fallback={loadingFallback ?? <DefaultLoadingFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export function AsyncBoundary(props: AsyncBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <Suspense fallback={props.loadingFallback ?? <DefaultLoadingFallback />}>
          <ErrorBoundaryWithParams reset={reset} {...props} />
        </Suspense>
      )}
    </QueryErrorResetBoundary>
  );
}

function ResolvedErrorFallback({
  errorFallback,
  ...props
}: FallbackProps & {
  errorFallback?: ReactNode | ((props: FallbackProps) => ReactNode);
}) {
  if (typeof errorFallback === "function") {
    return <>{errorFallback(props)}</>;
  }

  if (errorFallback) {
    return <>{errorFallback}</>;
  }

  return <DefaultErrorFallback {...props} />;
}

function DefaultLoadingFallback() {
  const t = useTranslations("asyncBoundary");

  return (
    <div className={styles.centered}>
      <div className={styles.card}>
        <div className={styles.loadingRow}>
          <div className={styles.spinner} />
          <p className={styles.title}>{t("loadingTitle")}</p>
        </div>
        <p className={styles.message}>{t("loadingMessage")}</p>
      </div>
    </div>
  );
}

function DefaultErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const t = useTranslations("asyncBoundary");
  const isNotFound = isNotFoundError(error);

  return (
    <div className={styles.centered}>
      <div className={`${styles.card} ${styles.errorCard}`}>
        <p className={styles.title}>{isNotFound ? t("notFoundTitle") : t("errorTitle")}</p>
        <p className={styles.message}>{isNotFound ? t("notFoundMessage") : t("errorMessage")}</p>
        <button type="button" onClick={resetErrorBoundary} className={styles.retryButton}>
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
