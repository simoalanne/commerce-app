import type { EnvConfig } from "#src/config.ts";

export const getOnlineStoreUrl = (config: Pick<EnvConfig, "ONLINE_STORE_URL">, path: string) => {
  if (!config.ONLINE_STORE_URL) {
    throw new Error(
      "missing ONLINE_STORE_URL environment variable, which is required to generate online store links",
    );
  }

  return new URL(path, config.ONLINE_STORE_URL).toString();
};
