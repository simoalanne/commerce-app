"use client";

import type { ReactNode } from "react";

import { StorefrontHeader } from "./StorefrontHeader";

type StorefrontLayoutChromeProps = {
  children: ReactNode;
};

export function StorefrontLayoutChrome({ children }: StorefrontLayoutChromeProps) {
  return (
    <>
      <StorefrontHeader />
      <div className="storefrontNarrowPageEdge">{children}</div>
    </>
  );
}
