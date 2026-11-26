const priceFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(value: number) {
  return priceFormatter.format(value);
}

export function formatPricePerKg(value: number) {
  return `${formatPrice(value)}/kg`;
}
