const priceFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "EUR",
});

export function formatCents(cents: number) {
  return priceFormatter.format(cents / 100);
}
