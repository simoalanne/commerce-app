import z from "zod";

import { adminAccountTable } from "#src/db/schema.ts";
import { dashboardTxRoute } from "#src/routing/base.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";

import { AlreadyAdmin, UserNotFound } from "./admins.errors.ts";

const adminTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const GrantAdminSchema = z.object({
  clerkId: z.string().min(1),
});

export const adminsRoutes = {
  grantAdmin: adminTxRoute
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

      const user = await context.db.query.user.findFirst({
        where: { clerkId: actualClerkId },
        with: { adminAccount: true },
      });

      if (!user) throw new UserNotFound();
      if (user.adminAccount) throw new AlreadyAdmin();

      const [adminAccount] = await context.db
        .insert(adminAccountTable)
        .values({ userId: actualClerkId })
        .returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "OTHER",
        entity: "adminAccount",
        entityId: adminAccount.id,
        details: {
          operation: "admins.grantAdmin",
          adminAccountId: adminAccount.id,
          targetUserId: user.clerkId,
          targetClerkId: actualClerkId,
          input: body.clerkId,
        },
      });

      return { success: true as const };
    }),
};
