import z from "zod";

import { orNotFound } from "#src/db/errors.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const LegalDocumentKeySchema = z.enum([
  "PRIVACY_NOTICE",
  "ORDER_AND_DELIVERY_TERMS",
  "RETURNS_AND_CANCELLATION",
  "CONTACT_INFORMATION",
]);

export const legalDocumentsRoutes = {
  getByKey: customerRoute
    .get("/legal-documents/:key")
    .params(z.object({ key: LegalDocumentKeySchema }))
    .handler(async ({ params, context }) => {
      const document = orNotFound(
        await context.db.query.legalDocument.findFirst({ where: { key: params.key } }),
      );

      return toResponse(
        {
          key: document.key,
          title: document.title,
          content: document.content,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
        context.locale,
      );
    }),
};
