import "dotenv/config";
import { createApp, createOpenApiDocument } from "@rest-rpc/server";
import { renderApiReference } from "@scalar/client-side-rendering";
import z from "zod";

import envConfig from "./config.ts";
import AuthProvider from "./integrations/auth/auth.provider.ts";
import { EmailService } from "./integrations/email/email.provider.ts";
import {
  filesystemObjectStorage,
  ObjectStorage,
} from "./integrations/object-storage/objectStorage.provider.ts";
import { getWebhookRoutes, paymentProviders } from "./integrations/payments/payment.provider.ts";
import { searchProvider } from "./integrations/search/search.provider.ts";
import { jobQueue } from "./jobs/queue.ts";
import logger from "./logger.ts";
import prismaClient from "./prisma.ts";
import { customerRouter, dashboardRouter } from "./routes.ts";
import type { AppContext } from "./routing/base.ts";
import {
  cors,
  reportError,
  reportErrors,
  requestContext,
  sendErrors,
} from "./routing/interceptors.ts";
import { rateLimit } from "./routing/rateLimit.ts";
import { runAppTransaction } from "./utils/runAppTransaction.ts";

const router = { customer: customerRouter, dashboard: dashboardRouter };

// Route modules never import these at runtime (contract extraction imports
// them without an environment), so they are provided as initial context.
const deps: Omit<AppContext, "headers"> = {
  db: prismaClient,
  config: envConfig,
  auth: AuthProvider,
  payments: paymentProviders,
  email: EmailService,
  storage: ObjectStorage,
  search: searchProvider,
  jobQueue,
  runAppTransaction,
};

const api = createApp(router, {
  context: (request) => ({ headers: request.headers, ...deps }),
  interceptors: [
    requestContext,
    cors,
    sendErrors,
    reportErrors,
    rateLimit({
      // The host puts a proxy in front in production and staging; locally the
      // socket address is the client.
      trustProxyHops:
        envConfig.NODE_ENV === "production" || envConfig.NODE_ENV === "staging"
          ? (envConfig.TRUST_PROXY_HOPS ?? 1)
          : 0,
    }),
  ],
});

// In production, the API is internal and not meant for outside use, so its
// docs are not served.
const docsRoutes: Record<string, Response> =
  envConfig.NODE_ENV !== "production"
    ? {
        "/api-docs/openapi.json": Response.json(
          createOpenApiDocument(router, {
            info: { title: "Acme API", version: "1.0.0" },
            schemaConverter: (schema, io) =>
              schema instanceof z.ZodType
                ? z.toJSONSchema(schema, { io, unrepresentable: "any" })
                : {},
          }),
        ),
        "/api-docs": new Response(
          renderApiReference({
            config: { url: "/api-docs/openapi.json" },
            pageTitle: "Acme API Docs",
          }),
          { headers: { "content-type": "text/html" } },
        ),
      }
    : {};

const server = Bun.serve({
  ...api,
  // The webhooks are third-party callers with their own signing, so they are
  // plain routes beside the API.
  // Local filesystem storage serves and accepts objects itself.
  routes: {
    ...api.routes,
    ...docsRoutes,
    ...(await getWebhookRoutes()),
    ...(filesystemObjectStorage ? filesystemObjectStorage.routes() : {}),
  },
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  // Request bodies here are small JSON; uploads go through presigned URLs,
  // which hit this server only with local filesystem storage.
  maxRequestBodySize: (filesystemObjectStorage ? 10 : 1) * 1024 * 1024,
  // Errors the interceptors never see, such as webhook handlers.
  error: (error) => {
    reportError(error);
    return new Response("Internal Server Error", { status: 500 });
  },
});
logger.info(`Server running at ${server.url}`);

void jobQueue.start({ runAppTransaction }).catch((error) => {
  logger.error("Failed to start background job queue", {
    tag: "job-queue",
    error,
  });
});

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  await server.stop();
  jobQueue.stop();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
