import "dotenv/config";
import * as Sentry from "@sentry/node";

import envConfig from "./config.ts";

const sentryDsn = envConfig.SENTRY_DSN?.trim();

Sentry.init({
  dsn: sentryDsn || undefined,
  enabled: Boolean(sentryDsn),
  environment: envConfig.NODE_ENV,
  tracesSampleRate: 0.1,
});
