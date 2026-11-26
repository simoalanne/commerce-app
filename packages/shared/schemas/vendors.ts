import z from "zod";

export const VendorFormSchema = z.object({
  name: z.string().min(1),
  slogan: z.string().min(1),
  story: z.string().min(1),
  storefrontVisibility: z.enum(["ACTIVE", "INACTIVE"]),
  isFeatured: z.boolean(),
  tags: z.array(z.string().min(1)),
  images: z.array(z.number().int()),
});
