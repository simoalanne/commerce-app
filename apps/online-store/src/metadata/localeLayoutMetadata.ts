import "server-only";
import type { Metadata } from "next";

import { getServerTranslations } from "@/i18n/serverTranslations";
import type { DestructuredRouteParams } from "@/types";

export async function generateLocaleLayoutMetadata(
  params: DestructuredRouteParams,
): Promise<Metadata> {
  const t = await getServerTranslations(params, "metadata.defaults");

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
    },
    twitter: {
      title: t("title"),
      description: t("description"),
    },
  };
}
