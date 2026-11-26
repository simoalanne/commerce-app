import "server-only";
import type { Messages, NamespaceKeys, NestedKeyOf } from "next-intl";
import { getTranslations } from "next-intl/server";

import type { DestructuredRouteParams } from "@/types";

import type { AppLocale } from "./routing";

/**
 * Retrieves server translations for the specified locale and optional namespace.
 * @param params - Route params next.js will pass to server components.
 * @param namespace - Optional namespace for the translations
 * @returns object containing the requested translations
 */
export async function getServerTranslations<
  NestedKey extends NamespaceKeys<Messages, NestedKeyOf<Messages>> = never,
>(params: DestructuredRouteParams, namespace?: NestedKey) {
  const { locale } = await params;
  return getTranslations({
    locale: locale as AppLocale,
    namespace,
  });
}
