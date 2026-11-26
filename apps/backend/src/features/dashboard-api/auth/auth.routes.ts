import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

export const authRoutes = {
  getSession: dashboardRoute
    .get("/auth/session")
    .meta({ access: "AUTHENTICATED" })
    .handler(async ({ context }) => {
      const user = await context.db.user.findUniqueOrThrow({
        where: { clerk_id: context.authContext.clerkId },
        select: { admin_account: { select: { id: true } } },
      });

      return toResponse({ role: user.admin_account ? ("ADMIN" as const) : null }, context.locale);
    }),
};
