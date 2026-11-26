import z from "zod";

export const LegalDocumentKeySchema = z.enum([
  "PRIVACY_NOTICE",
  "TERMS_OF_SALE",
  "RETURNS_AND_CANCELLATION",
  "CONTACT_INFORMATION",
]);

export const LegalDocumentUpsertSchema = z.object({
  key: LegalDocumentKeySchema,
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
});
