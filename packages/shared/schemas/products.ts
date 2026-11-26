import z from "zod";

const ProductImagesSchema = z
  .array(z.number().int())
  .refine((images) => new Set(images).size === images.length, {
    message: "image ids must be unique",
  });

export const ProductFormSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  weightGrams: z.number().int(),
  headline: z.string().min(1),
  fullDescription: z.string().min(1),
  storefrontVisibility: z.enum(["ACTIVE", "INACTIVE"]),
  isFeatured: z.boolean(),
  tags: z.array(z.number().int()),
  costPriceCents: z.int().nonnegative(),
  salesPriceCents: z.int().nonnegative(),
  currentStock: z.number().int(),
  vendorId: z.number().int(),
  images: ProductImagesSchema,
  categoryId: z.int().positive().nullable(),
  purchaseLimitPerOrder: z.int().min(0).max(99),
});
