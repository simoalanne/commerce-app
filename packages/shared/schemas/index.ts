import z from "zod";

export const OrderPricingSummarySchema = z.object({
  itemsSubtotalCents: z.int(),
  itemsDiscountCents: z.int().nullable(),
  discountedItemsSubtotalCents: z.int().nullable(),
  chargedTotalCents: z.int(),
  vatRate: z.int(),
  includedVatCents: z.int(),
  refundedCents: z.int().nullable().optional(),
});

export type OrderPricingSummary = z.infer<typeof OrderPricingSummarySchema>;
