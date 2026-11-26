import {
  LegalDocumentKeySchema,
  LegalDocumentUpsertSchema,
} from "@acme/shared/schemas/legalDocuments";
import z from "zod";

import { legalDocumentsRoutes as customerLegalDocumentsRoutes } from "#src/features/customer-api/legalDocuments/legalDocuments.routes.ts";
import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { buildTag } from "#src/utils/buildTags.ts";
import { mergeLocalizedString, toLocalizedString } from "#src/utils/localizedObject.ts";

const legalDocumentRoute = dashboardRoute.meta({ access: "ADMIN" });

export const legalDocumentsRoutes = {
  get: legalDocumentRoute
    .get("/legal-documents")
    .query(z.object({ key: LegalDocumentKeySchema }))
    .handler(async ({ query, context }) => {
      const document = await context.db.legalDocument.findUnique({
        where: { key: query.key },
      });

      return toResponse(
        document
          ? {
              key: document.key,
              title: document.title,
              content: document.content,
              createdAt: document.created_at,
              updatedAt: document.updated_at,
            }
          : null,
        context.locale,
      );
    }),

  upsert: legalDocumentRoute
    .put("/legal-documents")
    .body(LegalDocumentUpsertSchema)
    .handler(async ({ body, context }) => {
      const existingDocument = await context.db.legalDocument.findUnique({
        where: { key: body.key },
        select: {
          title: true,
          content: true,
        },
      });

      const document = await context.runAppTransaction(
        async ({ tx, enqueueJob, logAdminAction }) => {
          const document = await tx.legalDocument.upsert({
            where: {
              key: body.key,
            },
            update: {
              title: mergeLocalizedString(
                existingDocument?.title ?? null,
                body.title,
                context.locale,
              ),
              content: mergeLocalizedString(
                existingDocument?.content ?? null,
                body.content,
                context.locale,
              ),
            },
            create: {
              key: body.key,
              title: toLocalizedString(body.title, context.locale),
              content: toLocalizedString(body.content, context.locale),
            },
          });

          await logAdminAction({
            actor: context.authContext,
            action: existingDocument ? "UPDATE" : "CREATE",
            entity: "legalDocument",
            entityId: document.key,
            before: existingDocument ?? undefined,
            after: document,
          });

          await enqueueJob({
            type: "invalidateStorefrontCache",
            payload: {
              tags: [buildTag(customerLegalDocumentsRoutes.getByKey, body.key)],
            },
          });

          return document;
        },
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
