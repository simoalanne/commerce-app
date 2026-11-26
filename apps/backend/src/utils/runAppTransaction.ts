import type { Prisma } from "@prisma/client";

import { jobQueue, type TransactionalEnqueueJob } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";
import prismaClient from "#src/prisma.ts";

export type RunAppTransaction = <T>(
  callback: (context: {
    tx: Prisma.TransactionClient;
    enqueueJob: TransactionalEnqueueJob;
  }) => Promise<T>,
) => Promise<T>;

/**
 * A transaction whose enqueued jobs are handed to the in-memory queue after
 * commit. Routes get it through the Tx builders in routing/base.ts; jobs and
 * webhooks call it directly. With a Postgres-backed queue this becomes a plain
 * db.transaction.
 */
export const runAppTransaction: RunAppTransaction = async (callback) => {
  const jobIds: string[] = [];
  const result = await prismaClient.$transaction((tx) =>
    callback({
      tx,
      enqueueJob: async (params) => {
        const job = await jobQueue.enqueue({ ...params, transaction: tx });
        jobIds.push(job.id);
      },
    }),
  );

  try {
    await jobQueue.schedule(jobIds);
  } catch (error) {
    logger.error("Failed to schedule background jobs after transaction commit", {
      tag: "job-queue",
      jobIds,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  }

  return result;
};
