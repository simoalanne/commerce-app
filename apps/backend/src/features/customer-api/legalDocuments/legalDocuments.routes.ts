import { RouteError } from "@rest-rpc/server";
import z from "zod";

import { customerRoute } from "#src/routing/base.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";

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
      const document = await context.db.query.legalDocument.findFirst({
        where: { key: params.key },
      });
      if (!document) throw new RouteError("NOT_FOUND", { status: 404 });

      return resolveLocalizedFields(
        {
          key: document.key,
          title: document.title,
          content: document.content,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
        context.locale,
      );
    }),
};
