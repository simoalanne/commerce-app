import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];

export function getValidLocale(locale: unknown): AppLocale {
  if (typeof locale === "string" && routing.locales.includes(locale as AppLocale)) {
    return locale as AppLocale;
  }
  return routing.defaultLocale;
}
