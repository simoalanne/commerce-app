import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

type TranslationMessages = Record<string, unknown>;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const baseMessages = (await import(`./${locale}.json`)).default as TranslationMessages;

  return {
    locale,
    messages: baseMessages,
  };
});

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof import("./en.json");
  }
}
