export const contentLocales = ["en"] as const;

export type ContentLocale = (typeof contentLocales)[number];
