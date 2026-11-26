import { orNotFound } from "#src/db/errors.ts";
import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

export const authRoutes = {
  getSession: dashboardRoute
    .get("/auth/session")
    .meta({ access: "AUTHENTICATED" })
    .handler(async ({ context }) => {
      const user = orNotFound(
        await context.db.query.user.findFirst({
          where: { clerk_id: context.authContext.clerkId },
          columns: { clerk_id: true },
          with: { admin_account: { columns: { id: true } } },
        }),
      );

      return toResponse({ role: user.admin_account ? ("ADMIN" as const) : null }, context.locale);
    }),
};
