import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const adminActionLogRoute = dashboardRoute.meta({ access: "ADMIN" });

const ADMIN_ACTION_LOG_ENTRY_LIMIT = 1000;

export const adminActionLogsRoutes = {
  getAll: adminActionLogRoute.get("/admin-action-logs").handler(async ({ context }) => {
    const logs = await context.db.query.adminActionLog.findMany({
      orderBy: {
        created_at: "desc",
      },
      limit: ADMIN_ACTION_LOG_ENTRY_LIMIT,
    });

    return toResponse(
      logs.map((log) => ({
        id: log.id,
        adminAccountId: log.admin_account_id,
        adminEmail: log.admin_email,
        action: log.action,
        entity: log.entity,
        entityId: log.entity_id,
        details: log.details,
        createdAt: log.created_at,
      })),
    );
  }),
};
