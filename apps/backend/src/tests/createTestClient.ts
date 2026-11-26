import { createApp, createClient } from "@rest-rpc/server";

import envConfig from "#src/config.ts";
import prismaClient from "#src/prisma.ts";
import type { customerRouter, dashboardRouter } from "#src/routes.ts";
import type { AppContext } from "#src/routing/base.ts";
import { sendErrors } from "#src/routing/interceptors.ts";
import { runAppTransaction } from "#src/utils/runAppTransaction.ts";

import { createTestContext } from "./createTestContext.ts";

type Router = typeof customerRouter | typeof dashboardRouter;

// Runs the routes in process through app.fetch, so requests go through
// validation, middleware and error handling like over HTTP. Real database and
// transactions; anything that talks to the outside world is stubbed per test.
export const createTestClient = <TRouter extends Router>(
  router: TRouter,
  overrides: Partial<AppContext> = {},
) => {
  const context = createTestContext({
    db: prismaClient,
    config: envConfig,
    runAppTransaction,
    ...overrides,
  });
  const app = createApp<Router>(router, {
    context: (request) => ({ ...context, headers: request.headers }),
    interceptors: [sendErrors],
  });
  return createClient(router, { origin: "http://localhost", fetch: app.fetch });
};
