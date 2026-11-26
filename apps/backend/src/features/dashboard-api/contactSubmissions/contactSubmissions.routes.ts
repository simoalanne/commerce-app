import { ContactSubmissionStatusSchema } from "@acme/shared/schemas/contactSubmissions";
import { eq } from "drizzle-orm";
import z from "zod";

import { orNotFound } from "#src/db/errors.ts";
import { contactSubmissionTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";

const contactSubmissionRoute = dashboardRoute.meta({ access: "ADMIN" });
const contactSubmissionTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const contactSubmissionColumns = {
  id: true,
  topic: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  locale: true,
  status: true,
  created_at: true,
  updated_at: true,
} as const;

export const contactSubmissionsRoutes = {
  getAll: contactSubmissionRoute.get("/contact-submissions").handler(async ({ context }) => {
    const submissions = await context.db.query.contactSubmission.findMany({
      orderBy: {
        created_at: "desc",
      },
      columns: contactSubmissionColumns,
    });

    return toResponse(
      submissions.map(({ created_at, updated_at, ...rest }) => ({
        ...rest,
        createdAt: created_at,
        updatedAt: updated_at,
      })),
      context.locale,
    );
  }),

  getById: contactSubmissionRoute
    .get("/contact-submissions/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const { created_at, updated_at, ...rest } = orNotFound(
        await context.db.query.contactSubmission.findFirst({
          where: { id: params.id },
          columns: contactSubmissionColumns,
        }),
      );

      return toResponse(
        {
          ...rest,
          createdAt: created_at,
          updatedAt: updated_at,
        },
        context.locale,
      );
    }),

  updateStatus: contactSubmissionTxRoute
    .put("/contact-submissions/:id/status")
    .params(idParams)
    .body(z.object({ status: ContactSubmissionStatusSchema }))
    .handler(async ({ params, body, context }) => {
      const existingSubmission = orNotFound(
        await context.db.query.contactSubmission.findFirst({
          where: { id: params.id },
          columns: {
            status: true,
            topic: true,
          },
        }),
      );

      await context.db
        .update(contactSubmissionTable)
        .set({ status: body.status })
        .where(eq(contactSubmissionTable.id, params.id));

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "OTHER",
        entity: "contactSubmission",
        entityId: params.id,
        details: {
          operation: "contactSubmission.updateStatus",
          submissionId: params.id,
          fromStatus: existingSubmission.status,
          toStatus: body.status,
          topic: existingSubmission.topic,
        },
      });
    }),
};
