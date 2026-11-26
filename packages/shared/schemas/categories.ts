import z from "zod";

export const CategoryFormSchema = z.object({
  name: z.string().min(1),
  markup_percent: z.number().nonnegative().nullable(),
  image_id: z.int().positive(),
});
