import z from "zod";

// Saved customer addresses and the order snapshot share this shape.
export const ShippingAddressSchema = z.object({
  line1: z.string().trim().min(1).max(255),
  line2: z.string().trim().max(255).nullable(),
  postalCode: z.string().trim().min(1).max(32),
  city: z.string().trim().min(1).max(255),
  // ISO 3166-1 alpha-2.
  country: z.string().trim().length(2).toUpperCase(),
});

export type ShippingAddress = z.output<typeof ShippingAddressSchema>;

export const formatShippingAddressLines = (address: ShippingAddress) =>
  [address.line1, address.line2, `${address.postalCode} ${address.city}`, address.country].filter(
    (line): line is string => !!line,
  );
