import z from "zod";

import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

import { AlreadyAdmin, UserNotFound } from "./admins.errors.ts";

const adminRoute = dashboardRoute.meta({ access: "ADMIN" });

const GrantAdminSchema = z.object({
  clerkId: z.string().min(1),
});

export const adminsRoutes = {
  grantAdmin: adminRoute
    .post("/admins/grant")
    .body(GrantAdminSchema)
    .error(UserNotFound)
    .error(AlreadyAdmin)
    .handler(async ({ body, context }) => {
      const clerkId = body.clerkId.trim();
      let actualClerkId = clerkId;

      if (clerkId.includes("@")) {
        const identityUser = await context.auth.getUserByEmail(clerkId);
        if (!identityUser) throw new UserNotFound();
        actualClerkId = identityUser.id;
      }

      const user = await context.db.user.findUnique({
        where: { clerk_id: actualClerkId },
        include: { admin_account: true },
      });

      if (!user) throw new UserNotFound();
      if (user.admin_account) throw new AlreadyAdmin();

      await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const adminAccount = await tx.adminAccount.create({
          data: { user_id: actualClerkId },
        });

        await logAdminAction({
          actor: context.authContext,
          action: "OTHER",
          entity: "adminAccount",
          entityId: adminAccount.id,
          details: {
            operation: "admins.grantAdmin",
            adminAccountId: adminAccount.id,
            targetUserId: user.clerk_id,
            targetClerkId: actualClerkId,
            input: body.clerkId,
          },
        });
      });

      return toResponse({ success: true as const }, context.locale);
    }),
};
