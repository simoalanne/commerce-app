import envConfig from "#src/config.ts";

const normalizeStoreUrl = (url: string) => url.replace(/\/+$/, "");

type InvalidateStorefrontCachePayload = {
  tags: string[];
};

export async function invalidateStorefrontCache({ tags }: InvalidateStorefrontCachePayload) {
  if (tags.length === 0) {
    return;
  }

  const secret = envConfig.INTERNAL_API_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "missing or invalid INTERNAL_API_KEY environment variable, which is required to invalidate storefront cache",
    );
  }

  const endpoint = `${normalizeStoreUrl(envConfig.ONLINE_STORE_URL)}/api/internal/cache/invalidate`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(
      `Cache invalidation request failed with ${response.status} ${response.statusText}`,
    );
  }
}
