import z from "zod";

export const PromotionCodeDiscountTypeSchema = z.enum(["PERCENT", "FIXED"]);

export const PromotionCodeFormSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(1),
    isActive: z.boolean(),
    validFrom: z.iso.datetime().nullish(),
    validUntil: z.iso.datetime().nullish(),
    minimumItemsValueCents: z.int().nonnegative().nullish(),
    discountType: PromotionCodeDiscountTypeSchema,
    // Percent for PERCENT codes, cents for FIXED codes.
    discountValue: z.int().nonnegative(),
    usageLimit: z.number().int().positive().nullish(),
  })
  .refine(
    (data) =>
      data.validFrom == null || data.validUntil == null || data.validFrom <= data.validUntil,
    {
      message: "Valid until must be after valid from",
      path: ["validUntil"],
    },
  )
  .refine((data) => data.discountType !== "PERCENT" || data.discountValue <= 100, {
    message: "Percent discounts cannot exceed 100",
    path: ["discountValue"],
  });
