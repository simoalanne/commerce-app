import { AsyncLocalStorage } from "node:async_hooks";

import type { AuthContext } from "#src/routing/auth.ts";

type RequestContext = {
  requestId: string;
  clientRequestId?: string;
  // Set by the base route middleware, for tagging error reports.
  authContext?: AuthContext;
};

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const getRequestId = (): string | undefined => requestContextStorage.getStore()?.requestId;

export const getClientRequestId = (): string | undefined =>
  requestContextStorage.getStore()?.clientRequestId;
