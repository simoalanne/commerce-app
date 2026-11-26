import type { ReactNode } from "react";

import { StorefrontLayoutChrome } from "@/components/layout/StorefrontLayoutChrome";
import { StorefrontContextProvider } from "@/providers/StorefrontContextProvider";
import { getStorefrontContext } from "@/server/storefrontContext";
import type { RouteParams } from "@/types";

type CatalogLayoutProps = RouteParams & {
  children: ReactNode;
};

export default async function CatalogLayout({ params, children }: CatalogLayoutProps) {
  const storefrontContext = await getStorefrontContext(params);

  return (
    <StorefrontContextProvider value={storefrontContext}>
      <StorefrontLayoutChrome>{children}</StorefrontLayoutChrome>
    </StorefrontContextProvider>
  );
}
