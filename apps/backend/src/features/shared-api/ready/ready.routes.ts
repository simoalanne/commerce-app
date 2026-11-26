import { customerRoute, dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

export const customerReadyRoutes = {
  get: customerRoute.get("/ready").handler(() => toResponse({ status: "ok" as const })),
};

export const dashboardReadyRoutes = {
  get: dashboardRoute.get("/ready").handler(() => toResponse({ status: "ok" as const })),
};
