import * as Sentry from "@sentry/node";
import { sql } from "drizzle-orm";
import { fromDrizzle, PgBoss, type SendOptions } from "pg-boss";

import envConfig from "#src/config.ts";
import type { Db } from "#src/db/client.ts";
import logger from "#src/logger.ts";

import { type JobPayload, type JobType, jobDefinitions } from "./jobDefinitions.ts";

export type EnqueueJobParams<T extends JobType> = {
  type: T;
  payload: JobPayload<T>;
  /** pg-boss's send options, such as `startAfter` and `retryLimit`. */
  options?: Omit<SendOptions, "db">;
};

export type EnqueueJob = <T extends JobType>(params: EnqueueJobParams<T>) => Promise<void>;

export type JobHandlerContext = {
  jobQueue: JobQueue;
};

export type JobQueueEntry = {
  id: string;
  type: string;
  state: "created" | "retry" | "active" | "completed" | "cancelled" | "failed";
  retryCount: number;
  retryLimit: number;
  startAfter: Date;
  createdOn: Date;
  completedOn: Date | null;
  payload: unknown;
  output: unknown;
};

export type JobQueue = {
  /**
   * Writes the job through `db`. Given a transaction, the job exists only if
   * the transaction commits.
   */
  enqueue: <T extends JobType>(db: Db, params: EnqueueJobParams<T>) => Promise<void>;
  /** The latest jobs of every type, newest first. */
  listRecent: (limit: number) => Promise<JobQueueEntry[]>;
  /** Connects, installing or migrating pg-boss's schema and the queues. */
  start: () => Promise<void>;
  /** Runs the job handlers in this process. */
  work: (context: JobHandlerContext) => Promise<void>;
  stop: () => Promise<void>;
};

const MINUTE_SECONDS = 60;

// Most jobs succeed on the first attempt, and the rare failure is unlikely to
// clear up immediately, so retries start late: about 5 minutes, then about 10.
const queueOptions = {
  retryLimit: 2,
  retryDelay: 5 * MINUTE_SECONDS,
  retryBackoff: true,
  retryDelayMax: 60 * MINUTE_SECONDS,
};

const jobTypes = Object.keys(jobDefinitions) as JobType[];

const runJob = async (type: JobType, rawPayload: unknown, context: JobHandlerContext) => {
  const definition = jobDefinitions[type];
  // Each handler takes its own definition's parsed payload, which TypeScript
  // can't relate through the JobType union.
  const handler = definition.handler as (
    payload: unknown,
    context: JobHandlerContext,
  ) => Promise<void>;
  await handler(definition.schema.parse(rawPayload), context);
};

export const createJobQueue = (connectionString: string): JobQueue => {
  const boss = new PgBoss({ connectionString });

  boss.on("error", (error) => {
    logger.error("Job queue error", { tag: "job-queue", error: error.stack ?? error.message });
    Sentry.captureException(error);
  });

  return {
    enqueue: async (db, { type, payload, options }) => {
      await boss.send(type, payload, { ...options, db: fromDrizzle(db, sql) });
    },

    listRecent: async (limit) => {
      const { rows } = await boss.getDb().executeSql(
        `SELECT id, name, state, retry_count, retry_limit, start_after, created_on, completed_on, data, output
         FROM pgboss.job
         ORDER BY created_on DESC
         LIMIT $1`,
        [limit],
      );
      return rows.map((row) => ({
        id: row.id,
        type: row.name,
        state: row.state,
        retryCount: row.retry_count,
        retryLimit: row.retry_limit,
        startAfter: row.start_after,
        createdOn: row.created_on,
        completedOn: row.completed_on,
        payload: row.data,
        output: row.output,
      }));
    },

    start: async () => {
      await boss.start();
      for (const type of jobTypes) {
        // createQueue leaves an existing queue as it is.
        await boss.createQueue(type, queueOptions);
        await boss.updateQueue(type, queueOptions);
      }
    },

    work: async (context) => {
      for (const type of jobTypes) {
        await boss.work(type, async ([job]) => {
          await Sentry.withIsolationScope(async () => {
            try {
              await runJob(type, job.data, context);
            } catch (error) {
              logger.error("Background job failed", {
                tag: "job-queue",
                jobId: job.id,
                type,
                retryCount: job.retryCount,
                error: error instanceof Error ? (error.stack ?? error.message) : String(error),
              });
              Sentry.captureException(error, (scope) =>
                scope.setContext("job", { jobId: job.id, type, retryCount: job.retryCount }),
              );
              throw error;
            }
          });
        });
      }
      logger.info("Background job workers started", { tag: "job-queue" });
    },

    stop: () => boss.stop(),
  };
};

export const jobQueue = createJobQueue(envConfig.DATABASE_URL);
