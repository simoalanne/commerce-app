import { RouteError } from "@rest-rpc/server";

import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

export const authRoutes = {
  getSession: dashboardRoute
    .get("/auth/session")
    .meta({ access: "AUTHENTICATED" })
    .handler(async ({ context }) => {
      const user = await context.db.query.user.findFirst({
        where: { clerkId: context.authContext.clerkId },
        columns: { clerkId: true },
        with: { adminAccount: { columns: { id: true } } },
      });
      if (!user) throw new RouteError("NOT_FOUND", { status: 404 });

      return toResponse({ role: user.adminAccount ? ("ADMIN" as const) : null }, context.locale);
    }),
};
