import { tagForEndpoint } from "@acme/shared";
import type { RouteDefinition } from "@rest-rpc/server";

type RouteWithPath = { readonly "~restrpc": Pick<RouteDefinition, "path"> };

// Tags the storefront cache entry of a customer route, the way the online
// store's server client does, from the route's resolved path.
export const buildTag = (route: RouteWithPath, value?: string | number) => {
  const { path } = route["~restrpc"];
  if (!path) throw new Error("Route has no resolved path");
  return tagForEndpoint(path, value);
};
