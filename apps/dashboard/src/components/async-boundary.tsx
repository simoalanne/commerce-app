import { RouteError } from "@rest-rpc/core";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useLocation } from "react-router-dom";

type Props = {
  children: ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode | ((props: FallbackProps) => ReactNode);
};

const isNotFoundError = (error: unknown) => error instanceof RouteError && error.status === 404;

export function AsyncBoundary({ children, loadingFallback, errorFallback }: Props) {
  const location = useLocation();

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={[location.pathname, location.search]}
          fallbackRender={(props) => (
            <ResolvedErrorFallback errorFallback={errorFallback} {...props} />
          )}
        >
          <Suspense fallback={loadingFallback ?? <DefaultLoadingFallback />}>{children}</Suspense>
        </ErrorBoundary>
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

function CenteredState({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen w-full items-center justify-center p-6">{children}</div>;
}

function DefaultLoadingFallback() {
  return (
    <CenteredState>
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          <p className="text-sm font-medium text-slate-800">Loading content...</p>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Fetching the latest data. This should only take a moment.
        </p>
      </div>
    </CenteredState>
  );
}

function DefaultErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isNotFound = isNotFoundError(error);

  return (
    <CenteredState>
      <div className="w-full max-w-sm rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm font-semibold text-rose-800">
          {isNotFound ? "Content not found" : "Something went wrong"}
        </p>
        <p className="mt-2 text-xs text-rose-700">
          {isNotFound
            ? "This content may have been removed or the link may be invalid."
            : "Failed to load content. Try refreshing the page or see the console for more details."}
        </p>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="mt-4 rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
        >
          Try again
        </button>
      </div>
    </CenteredState>
  );
}
