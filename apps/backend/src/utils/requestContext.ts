import { AsyncLocalStorage } from "node:async_hooks";

export const requestContextStorage = new AsyncLocalStorage<{ requestId: string }>();

export const getRequestId = (): string | undefined => requestContextStorage.getStore()?.requestId;
