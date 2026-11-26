// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn: sentryDsn || undefined,

  enabled: Boolean(sentryDsn),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
