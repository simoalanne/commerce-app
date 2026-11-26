const euroFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" });

/** Formats an integer amount of cents, the unit every money field uses. */
export const formatCents = (cents: number) => euroFormatter.format(cents / 100);
