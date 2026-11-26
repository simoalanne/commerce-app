import type { Prisma } from "@prisma/client";

import { jobQueue, type TransactionalEnqueueJob } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";
import prismaClient from "#src/prisma.ts";

import { type LogAdminActionInput, logAdminAction } from "./adminActionLog.ts";

export type AppTransactionContext = {
  tx: Prisma.TransactionClient;
  enqueueJob: TransactionalEnqueueJob;
  logAdminAction: (input: Omit<LogAdminActionInput, "tx">) => Promise<void>;
};

export type RunAppTransaction = <T>(
  callback: (context: AppTransactionContext) => Promise<T>,
) => Promise<T>;

export const runAppTransaction: RunAppTransaction = async (callback) => {
  const { result, jobIds } = await prismaClient.$transaction(async (tx) => {
    const jobIds: string[] = [];
    const enqueueJob: TransactionalEnqueueJob = async (params) => {
      const job = await jobQueue.enqueue({
        ...params,
        transaction: tx,
      });
      jobIds.push(job.id);
    };

    const transactionLogAdminAction: (input: Omit<LogAdminActionInput, "tx">) => Promise<void> = (
      input,
    ) =>
      logAdminAction({
        ...input,
        tx,
      } as LogAdminActionInput);

    const result = await callback({
      tx,
      enqueueJob,
      logAdminAction: transactionLogAdminAction,
    });

    return { result, jobIds };
  });

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
