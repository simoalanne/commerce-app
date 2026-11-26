import z from "zod";

export const PromotionCodeDiscountTypeSchema = z.enum(["PERCENT", "FIXED"]);

export const PromotionCodeFormSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(1),
    is_active: z.boolean(),
    valid_from: z.coerce.date().nullish(),
    valid_until: z.coerce.date().nullish(),
    minimum_items_value_cents: z.int().nonnegative().nullish(),
    discount_type: PromotionCodeDiscountTypeSchema,
    // Percent for PERCENT codes, cents for FIXED codes.
    discount_value: z.int().nonnegative(),
    usage_limit: z.number().int().positive().nullish(),
    times_used: z.number().int().nonnegative().default(0),
    created_at: z.coerce.date().optional(),
    updated_at: z.coerce.date().optional(),
  })
  .refine(
    (data) =>
      data.valid_from == null || data.valid_until == null || data.valid_from <= data.valid_until,
    {
      message: "Valid until must be after valid from",
      path: ["valid_until"],
    },
  )
  .refine((data) => data.discount_type !== "PERCENT" || data.discount_value <= 100, {
    message: "Percent discounts cannot exceed 100",
    path: ["discount_value"],
  });
