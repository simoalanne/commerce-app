import { ContactSubmissionStatusSchema } from "@acme/shared/schemas/contactSubmissions";
import z from "zod";

import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const contactSubmissionRoute = dashboardRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const contactSubmissionSelect = {
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
    const submissions = await context.db.contactSubmission.findMany({
      orderBy: {
        created_at: "desc",
      },
      select: contactSubmissionSelect,
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
      const { created_at, updated_at, ...rest } =
        await context.db.contactSubmission.findUniqueOrThrow({
          where: { id: params.id },
          select: contactSubmissionSelect,
        });

      return toResponse(
        {
          ...rest,
          createdAt: created_at,
          updatedAt: updated_at,
        },
        context.locale,
      );
    }),

  updateStatus: contactSubmissionRoute
    .put("/contact-submissions/:id/status")
    .params(idParams)
    .body(z.object({ status: ContactSubmissionStatusSchema }))
    .handler(async ({ params, body, context }) => {
      const existingSubmission = await context.db.contactSubmission.findUniqueOrThrow({
        where: { id: params.id },
        select: {
          status: true,
          topic: true,
        },
      });

      await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        await tx.contactSubmission.update({
          where: { id: params.id },
          data: { status: body.status },
        });

        await logAdminAction({
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
      });
    }),
};
