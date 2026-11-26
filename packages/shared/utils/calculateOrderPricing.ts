import type { OrderPricingSummary } from "../schemas/index.ts";

// One flat placeholder rate; tax rules per product or region are out of scope.
export const ORDER_VAT_RATE = 20;

const roundPrice = (value: number) => Math.round(value * 100) / 100;
const getChargedTotal = (itemsSubtotal: number, deliveryFee: number, tipAmount: number) =>
  roundPrice(itemsSubtotal + deliveryFee + tipAmount);

const getDiscountFor = (
  price: number,
  discountType?: "PERCENT" | "FIXED",
  discountValue?: number,
) => {
  if (!discountType || !discountValue) {
    return {
      discountAmount: null,
      discountedPrice: null,
    };
  }

  if (discountType === "PERCENT") {
    const discountAmount = roundPrice(price * (discountValue / 100));
    return {
      discountAmount,
      discountedPrice: roundPrice(price - discountAmount),
    };
  }

  return {
    discountAmount: Math.min(price, discountValue),
    discountedPrice: roundPrice(price - Math.min(price, discountValue)),
  };
};

const getIncludedVatAmount = (grossAmount: number, vatRate: number) =>
  roundPrice((grossAmount * vatRate) / (100 + vatRate));

type OrderPricingInput = {
  itemsSubtotal: number;
  deliveryFee: number;
  tipPercentage?: number;
  discountType?: "ITEMS_PERCENT" | "ITEMS_FIXED" | "DELIVERY_PERCENT" | "DELIVERY_FIXED";
  discountValue?: number;
};

export const calculateOrderPricing = ({
  itemsSubtotal,
  deliveryFee,
  tipPercentage = 0,
  discountType,
  discountValue = 0,
}: OrderPricingInput): OrderPricingSummary => {
  const { discountAmount: itemsDiscountAmount, discountedPrice: discountedItemsSubtotal } =
    getDiscountFor(
      itemsSubtotal,
      discountType === "ITEMS_PERCENT"
        ? "PERCENT"
        : discountType === "ITEMS_FIXED"
          ? "FIXED"
          : undefined,
      discountValue,
    );

  const { discountAmount: deliveryDiscountAmount, discountedPrice: discountedDeliveryFee } =
    getDiscountFor(
      deliveryFee,
      discountType === "DELIVERY_PERCENT"
        ? "PERCENT"
        : discountType === "DELIVERY_FIXED"
          ? "FIXED"
          : undefined,
      discountValue,
    );

  const tipBaseAmount = discountedItemsSubtotal ?? itemsSubtotal;
  const tipAmount = tipPercentage > 0 ? roundPrice((tipBaseAmount * tipPercentage) / 100) : null;
  const taxableGrossAmount = roundPrice(
    (discountedItemsSubtotal ?? itemsSubtotal) + (discountedDeliveryFee ?? deliveryFee),
  );

  return {
    itemsSubtotal,
    itemsDiscountAmount,
    discountedItemsSubtotal,
    deliveryFee,
    deliveryDiscountAmount,
    discountedDeliveryFee,
    tipPercentage: tipPercentage || null,
    tipAmount,
    chargedTotal: getChargedTotal(
      discountedItemsSubtotal ?? itemsSubtotal,
      discountedDeliveryFee ?? deliveryFee,
      tipAmount ?? 0,
    ),
    vatRate: ORDER_VAT_RATE,
    includedVatAmount: getIncludedVatAmount(taxableGrossAmount, ORDER_VAT_RATE),
  };
};
