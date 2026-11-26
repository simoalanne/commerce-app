// One flat placeholder rate in whole percent; tax rules per product or region
// are out of scope.
const ORDER_VAT_RATE = 20;

/** VAT included in a gross amount, in cents. */
const getIncludedVatCents = (grossCents: number, vatRate: number) =>
  Math.round((grossCents * vatRate) / (100 + vatRate));

type OrderPricingInput = {
  itemsSubtotalCents: number;
  discountType?: "PERCENT" | "FIXED";
  /** Percent for PERCENT, cents for FIXED. */
  discountValue?: number;
};

export const calculateOrderPricing = ({
  itemsSubtotalCents,
  discountType,
  discountValue = 0,
}: OrderPricingInput) => {
  const itemsDiscountCents =
    !discountType || !discountValue
      ? null
      : discountType === "PERCENT"
        ? Math.round((itemsSubtotalCents * discountValue) / 100)
        : Math.min(itemsSubtotalCents, discountValue);
  const discountedItemsSubtotalCents =
    itemsDiscountCents === null ? null : itemsSubtotalCents - itemsDiscountCents;
  const chargedTotalCents = discountedItemsSubtotalCents ?? itemsSubtotalCents;

  return {
    itemsSubtotalCents,
    itemsDiscountCents,
    discountedItemsSubtotalCents,
    chargedTotalCents,
    vatRate: ORDER_VAT_RATE,
    includedVatCents: getIncludedVatCents(chargedTotalCents, ORDER_VAT_RATE),
  };
};
