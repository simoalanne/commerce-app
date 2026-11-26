/**
 * Supported locales of the app.
 */
export const supportedLocales = ["en"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];
