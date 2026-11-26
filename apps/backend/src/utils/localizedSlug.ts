import { slugify } from "@acme/shared";

import type { LocalizedString } from "#src/db/json.ts";

export const buildLocalizedSlugFromLocalizedText = (value: LocalizedString): LocalizedString =>
  Object.fromEntries(
    Object.entries(value).flatMap(([locale, text]) =>
      typeof text === "string" && text.trim().length > 0 ? [[locale, slugify(text)]] : [],
    ),
  );
