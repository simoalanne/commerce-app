import "server-only";
import { tagForEndpoint } from "@acme/shared";
import { clientInterceptor } from "@rest-rpc/core";

import { createCustomerClient } from "@/api/client";
import type { DestructuredRouteParams } from "@/types";

// The tag of today's autoTag: the path without params, plus the value of the
// first param, so revalidateTag() can target one entity.
const tagForRequest = (path: string, url: string) => {
  const pathSegments = path.split("/");
  const urlSegments = new URL(url).pathname.split("/");
  const firstParamIndex = pathSegments.findIndex((segment) => segment.startsWith(":"));
  const identity =
    firstParamIndex === -1 ? undefined : decodeURIComponent(urlSegments[firstParamIndex] ?? "");

  return tagForEndpoint(path, identity);
};

// Aborts a request that gets no response in time. The body is read after it.
export const timeout = (ms: number) =>
  clientInterceptor(({ request, next }) =>
    next(
      new Request(request, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(ms)]) }),
    ),
  );

// The tags depend on the called route, so this last interceptor sends the
// request itself with Next's `next` fetch option instead of the client's
// `fetchOptions`. Per-call `cache: "no-store" | "no-cache"` skip the Next cache.
export const nextCache = (revalidate: number) =>
  clientInterceptor(({ request, route }) =>
    request.method === "GET" && request.cache === "default"
      ? fetch(request, {
          next: { revalidate, tags: [tagForRequest(route.path, request.url)] },
        })
      : fetch(request),
  );

export default async function createServerSideApiClient(
  params: DestructuredRouteParams | Promise<{ locale: string }>,
) {
  const { locale } = await params;

  return createCustomerClient({
    // Tags make revalidateTag() precise, the time-based revalidation is the fallback.
    interceptors: [timeout(5000), nextCache(900)],
    globalHeaders: {
      "accept-language": locale,
      "x-acme-client": "online-store-next-server",
    },
  });
}
