import { sql } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import {
  adminAccountTable,
  categoryTable,
  customerAccountTable,
  customerAddressTable,
  orderTable,
  productTable,
  reviewTable,
  userTable,
  vendorTable,
  webhookSubscriptionTable,
} from "#src/db/schema.ts";
import { jobQueue } from "#src/jobs/queue.ts";

const truncateAllTablesSql = sql`
TRUNCATE TABLE
	${adminAccountTable},
	${orderTable},
	${customerAddressTable},
	${customerAccountTable},
	${reviewTable},
	${productTable},
	${categoryTable},
	${vendorTable},
	${webhookSubscriptionTable},
	${userTable}
RESTART IDENTITY CASCADE;
`;

const isTestDatabaseConnectionFailure = (error: Record<string, unknown>) => {
  const likelyErrorCodesForConnectionFailure = [
    "ECONNREFUSED",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "EPIPE",
  ];
  return likelyErrorCodesForConnectionFailure.includes(error.code as string);
};

export const bootstrapTestDatabase = async () => {
  try {
    await db.execute(truncateAllTablesSql);
    // Installs or migrates pg-boss's schema and creates the queues, then
    // clears jobs left by earlier runs.
    await jobQueue.start();
    await jobQueue.stop();
    await db.execute(sql`TRUNCATE pgboss.job`);
  } catch (cause) {
    if (isTestDatabaseConnectionFailure(cause as Record<string, unknown>)) {
      throw new Error(
        `Failed to connect to the test database. Make sure the test database is running and accessible.
				Start it with "docker compose up -d" in the repo root.`,
        { cause },
      );
    }

    throw new Error(
      `Failed to bootstrap the test database. Try running pnpm test:db:init to sync with the latest schema. 
			If problem persists, check the raw error for more details.`,
      { cause },
    );
  }
};
