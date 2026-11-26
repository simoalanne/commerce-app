import type { Metadata } from "next";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

const metadataBase = rawSiteUrl
  ? (() => {
      try {
        return new URL(rawSiteUrl);
      } catch {
        console.error(`Invalid NEXT_PUBLIC_SITE_URL value "${rawSiteUrl}". Skipping metadataBase.`);
        return undefined;
      }
    })()
  : undefined;

export const siteMetadata: Metadata = {
  applicationName: "Acme",
  referrer: "origin-when-cross-origin",
  category: "ecommerce",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "Acme",
  },
  twitter: {
    card: "summary_large_image",
  },
  metadataBase,
};
