import z from "zod";

export const DeliveryInstructionsSchema = z.object({
  freeForm: z.string().trim().max(1000).optional(),
  apartmentEntrance: z.enum(["buzzer", "code", "openDoor", "other"]).optional(),
  doorCode: z.string().trim().max(64).optional(),
});

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
