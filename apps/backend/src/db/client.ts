import { drizzle, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";

import envConfig from "#src/config.ts";

import { relations } from "./relations.ts";

/**
 * The database or a transaction: Drizzle transactions are database objects
 * too, and db.transaction() inside one opens a savepoint.
 */
export type Db = PgAsyncDatabase<NodePgQueryResultHKT, typeof relations>;

export const db = drizzle({
  connection: { connectionString: envConfig.DATABASE_URL },
  relations,
});
