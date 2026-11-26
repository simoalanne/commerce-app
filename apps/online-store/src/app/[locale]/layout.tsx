import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Instrument_Sans, Inter } from "next/font/google";
import type React from "react";

import "@/app/globals.css";
import { type AppLocale, routing } from "@/i18n/routing";
import { generateLocaleLayoutMetadata } from "@/metadata/localeLayoutMetadata";
import { siteMetadata } from "@/metadata/siteMetadata";
import { AppProviders } from "@/providers/AppProviders";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const brandFont = Instrument_Sans({
  variable: "--font-brand",
  subsets: ["latin"],
});

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);

  const localeMetadata = await generateLocaleLayoutMetadata(params);

  return {
    ...siteMetadata,
    ...localeMetadata,
    openGraph: {
      ...siteMetadata.openGraph,
      ...localeMetadata.openGraph,
    },
    twitter: {
      ...siteMetadata.twitter,
      ...localeMetadata.twitter,
    },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL;

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      {assetsUrl ? (
        <head>
          <link rel="preconnect" href={assetsUrl} crossOrigin="anonymous" />
        </head>
      ) : null}
      <body
        className={`
					${bodyFont.variable}
					${brandFont.variable}
					min-h-full bg-background text-foreground`}
      >
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
