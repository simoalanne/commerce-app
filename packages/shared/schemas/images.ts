import z from "zod";

export const ImageMetadataSchema = z
  .object({
    name: z.string().nullish(),
    alt: z.string().nullish(),
  })
  .strict();
