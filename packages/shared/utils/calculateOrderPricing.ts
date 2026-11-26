import type { OrderPricingSummary } from "../schemas/index.ts";

// One flat placeholder rate; tax rules per product or region are out of scope.
export const ORDER_VAT_RATE = 20;

const roundPrice = (value: number) => Math.round(value * 100) / 100;

const getIncludedVatAmount = (grossAmount: number, vatRate: number) =>
  roundPrice((grossAmount * vatRate) / (100 + vatRate));

type OrderPricingInput = {
  itemsSubtotal: number;
  discountType?: "PERCENT" | "FIXED";
  discountValue?: number;
};

export const calculateOrderPricing = ({
  itemsSubtotal,
  discountType,
  discountValue = 0,
}: OrderPricingInput): OrderPricingSummary => {
  const itemsDiscountAmount =
    !discountType || !discountValue
      ? null
      : discountType === "PERCENT"
        ? roundPrice(itemsSubtotal * (discountValue / 100))
        : Math.min(itemsSubtotal, discountValue);
  const discountedItemsSubtotal =
    itemsDiscountAmount === null ? null : roundPrice(itemsSubtotal - itemsDiscountAmount);
  const chargedTotal = roundPrice(discountedItemsSubtotal ?? itemsSubtotal);

  return {
    itemsSubtotal,
    itemsDiscountAmount,
    discountedItemsSubtotal,
    chargedTotal,
    vatRate: ORDER_VAT_RATE,
    includedVatAmount: getIncludedVatAmount(chargedTotal, ORDER_VAT_RATE),
  };
};
