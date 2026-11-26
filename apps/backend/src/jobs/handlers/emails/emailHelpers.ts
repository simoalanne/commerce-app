export const formatLine = (template: string, values: Record<string, string | number>): string =>
  template.replaceAll(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

export const formatCents = (cents: number, locale = "en"): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";
