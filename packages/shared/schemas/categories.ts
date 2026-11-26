import z from "zod";

export const CategoryFormSchema = z.object({
  name: z.string().min(1),
  markupPercent: z.number().nonnegative().nullable(),
  imageId: z.int().positive(),
});
