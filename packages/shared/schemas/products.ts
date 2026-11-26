import z from "zod";

const ProductImagesSchema = z
  .array(z.number().int())
  .refine((images) => new Set(images).size === images.length, {
    message: "image ids must be unique",
  });

export const ProductFormSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  weight_grams: z.number().int(),
  headline: z.string().min(1),
  full_description: z.string().min(1),
  storefront_visibility: z.enum(["ACTIVE", "INACTIVE"]),
  is_featured: z.boolean(),
  tags: z.array(z.number().int()),
  cost_price_cents: z.int().nonnegative(),
  sales_price_cents: z.int().nonnegative(),
  current_stock: z.number().int(),
  vendor_id: z.number().int(),
  images: ProductImagesSchema,
  category_id: z.int().positive().nullable(),
  purchase_limit_per_order: z.int().min(0).max(99),
});
