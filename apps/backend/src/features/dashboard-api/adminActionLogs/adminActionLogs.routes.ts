import { dashboardRoute } from "#src/routing/base.ts";

const adminActionLogRoute = dashboardRoute.meta({ access: "ADMIN" });

const ADMIN_ACTION_LOG_ENTRY_LIMIT = 1000;

export const adminActionLogsRoutes = {
  getAll: adminActionLogRoute.get("/admin-action-logs").handler(async ({ context }) => {
    const logs = await context.db.query.adminActionLog.findMany({
      orderBy: { createdAt: "desc" },
      limit: ADMIN_ACTION_LOG_ENTRY_LIMIT,
      with: { adminAccount: { columns: { userId: true } } },
    });
    const admins = await context.auth.getUsersByIds([
      ...new Set(logs.flatMap((log) => (log.adminAccount ? [log.adminAccount.userId] : []))),
    ]);
    const emailsById = new Map(admins.map((admin) => [admin.id, admin.email]));

    return logs.map(({ adminAccount, ...log }) => ({
      ...log,
      adminEmail: adminAccount ? (emailsById.get(adminAccount.userId) ?? null) : null,
    }));
  }),
};
