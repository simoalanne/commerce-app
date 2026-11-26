import { drizzle, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";
import pg from "pg";

import envConfig from "#src/config.ts";

import { relations } from "./relations.ts";

/**
 * The database or a transaction: Drizzle transactions are database objects
 * too, and db.transaction() inside one opens a savepoint.
 */
export type Db = PgAsyncDatabase<NodePgQueryResultHKT, typeof relations>;

// Timestamp columns hold UTC. Drizzle's queries read them so, but raw
// db.execute() rows go through pg's parsers, which read a timestamp without
// time zone as local time.
const types = {
  getTypeParser: ((oid: number, format?: "text" | "binary") =>
    oid === pg.types.builtins.TIMESTAMP && format !== "binary"
      ? (value: string) => new Date(`${value.replace(" ", "T")}Z`)
      : pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
};

export const db = drizzle({
  connection: { connectionString: envConfig.DATABASE_URL, types },
  relations,
});
