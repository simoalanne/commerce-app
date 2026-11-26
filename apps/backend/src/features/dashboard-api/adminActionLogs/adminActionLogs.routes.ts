import { dashboardRoute } from "#src/routing/base.ts";

const adminActionLogRoute = dashboardRoute.meta({ access: "ADMIN" });

const ADMIN_ACTION_LOG_ENTRY_LIMIT = 1000;

export const adminActionLogsRoutes = {
  getAll: adminActionLogRoute.get("/admin-action-logs").handler(async ({ context }) => {
    const logs = await context.db.query.adminActionLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      limit: ADMIN_ACTION_LOG_ENTRY_LIMIT,
    });

    return logs.map((log) => ({
      id: log.id,
      adminAccountId: log.adminAccountId,
      adminEmail: log.adminEmail,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details,
      createdAt: log.createdAt,
    }));
  }),
};
