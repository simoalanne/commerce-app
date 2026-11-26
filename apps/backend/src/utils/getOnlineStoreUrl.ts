import type { EnvConfig } from "#src/config.ts";

export const getOnlineStoreUrl = (config: Pick<EnvConfig, "ONLINE_STORE_URL">, path: string) =>
  new URL(path, config.ONLINE_STORE_URL).toString();
