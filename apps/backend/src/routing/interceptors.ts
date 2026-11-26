import { randomUUID } from "node:crypto";

import { errorResponse, interceptor, onError, RouteError } from "@rest-rpc/server";
import * as Sentry from "@sentry/node";

import logger from "#src/logger.ts";
import { isNotFoundError } from "#src/utils/isNotFoundError.ts";
import {
  getClientRequestId,
  getRequestId,
  requestContextStorage,
} from "#src/utils/requestContext.ts";

// The response's headers may be immutable, so headers are set on a copy.
const withHeaders = (response: Response, headers: Record<string, string>) => {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    copy.headers.set(name, value);
  }
  return copy;
};

/** Gives the request an id, in the logger's context and the response. */
export const requestContext = interceptor(async ({ request, next }) => {
  const requestId = randomUUID();
  const clientRequestId = request.headers.get("x-request-id") ?? undefined;

  return requestContextStorage.run({ requestId, clientRequestId }, async () => {
    const startedAt = Date.now();
    const response = await next();
    logger.debug("API request processed", {
      method: request.method,
      url: request.url,
      durationMs: Date.now() - startedAt,
    });
    return withHeaders(response, { "x-request-id": requestId });
  });
});

// Open: auth is a bearer token set explicitly by our clients, never an ambient
// credential like a cookie, so no origin can act as a user by itself.
export const cors = interceptor(async ({ request, next }) => {
  const response =
    request.method === "OPTIONS"
      ? new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
            // Mirrors what the browser asks for, so the list needs no upkeep.
            "access-control-allow-headers":
              request.headers.get("access-control-request-headers") ?? "",
          },
        })
      : await next();

  return withHeaders(response, {
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "Content-Disposition",
  });
});

/**
 * Sends thrown errors as responses, so the interceptors before it (CORS, request
 * id) see them. A Prisma not-found is a 404.
 */
export const sendErrors = interceptor(({ next }) =>
  next().catch((error) =>
    errorResponse(
      isNotFoundError(error)
        ? new RouteError("NOT_FOUND", {
            status: 404,
            message: "Resource not found",
          })
        : error,
    ),
  ),
);

export const reportError = (error: unknown) => {
  if (error instanceof RouteError) return;

  logger.error("Unexpected error occurred:", error);

  Sentry.captureException(error, (scope) => {
    scope.setContext("request", {
      requestId: getRequestId(),
      clientRequestId: getClientRequestId(),
    });

    const authContext = requestContextStorage.getStore()?.authContext;
    if (!authContext?.isAuthenticated) return scope;

    scope.setUser({ id: authContext.clerkId });
    scope.setTag("customerId", authContext.customerId);
    if (authContext.adminId) scope.setTag("adminId", authContext.adminId);

    return scope;
  });
};

/** Reports errors that are not route errors, after `sendErrors` is out of the way. */
export const reportErrors = onError(reportError);
