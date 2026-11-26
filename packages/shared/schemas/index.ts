import z from "zod";

export const NonEmptyString = z.string().trim().min(1);

export const DeliveryInstructionsSchema = z.object({
  freeForm: z.string().trim().max(1000).optional(),
  apartmentEntrance: z.enum(["buzzer", "code", "openDoor", "other"]).optional(),
  doorCode: z.string().trim().max(64).optional(),
});

export const ProductStatusSchema = z.enum(["DRAFT", "ACTIVE", "FEATURED", "ARCHIVED"]);

type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const CUSTOMER_VISIBLE_PRODUCT_STATUSES = [
  "ACTIVE",
  "FEATURED",
] as const satisfies readonly ProductStatus[];

export const PURCHASABLE_PRODUCT_STATUSES = CUSTOMER_VISIBLE_PRODUCT_STATUSES;

export const ACTIVE_PRODUCT_STATUSES = CUSTOMER_VISIBLE_PRODUCT_STATUSES;

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
