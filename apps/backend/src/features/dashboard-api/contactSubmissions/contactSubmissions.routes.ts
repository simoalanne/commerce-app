import { ContactSubmissionStatusSchema } from "@acme/shared/schemas/contactSubmissions";
import { RouteError } from "@rest-rpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { contactSubmissionTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";

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
  createdAt: true,
  updatedAt: true,
} as const;

export const contactSubmissionsRoutes = {
  getAll: contactSubmissionRoute.get("/contact-submissions").handler(async ({ context }) => {
    const submissions = await context.db.query.contactSubmission.findMany({
      orderBy: {
        createdAt: "desc",
      },
      columns: contactSubmissionColumns,
    });

    return submissions.map(({ createdAt, updatedAt, ...rest }) => ({
      ...rest,
      createdAt,
      updatedAt,
    }));
  }),

  getById: contactSubmissionRoute
    .get("/contact-submissions/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const submission = await context.db.query.contactSubmission.findFirst({
        where: { id: params.id },
        columns: contactSubmissionColumns,
      });
      if (!submission) throw new RouteError("NOT_FOUND", { status: 404 });
      const { createdAt, updatedAt, ...rest } = submission;

      return {
        ...rest,
        createdAt,
        updatedAt,
      };
    }),

  updateStatus: contactSubmissionTxRoute
    .put("/contact-submissions/:id/status")
    .params(idParams)
    .body(z.object({ status: ContactSubmissionStatusSchema }))
    .handler(async ({ params, body, context }) => {
      const [updated] = await context.db
        .update(contactSubmissionTable)
        .set({ status: body.status })
        .where(eq(contactSubmissionTable.id, params.id))
        .returning({ id: contactSubmissionTable.id });
      if (!updated) throw new RouteError("NOT_FOUND", { status: 404 });
    }),
};
