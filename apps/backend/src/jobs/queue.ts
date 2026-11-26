import type { Job, Prisma } from "@prisma/client";

import type { RunAppTransaction } from "#src/utils/runAppTransaction.ts";

import type { JobPayload, JobType } from "./jobDefinitions.ts";
import { PersistentInMemoryJobQueue } from "./persistentInMemoryQueue.ts";

export type EnqueueJobParams<T extends JobType> = {
  type: T;
  payload: JobPayload<T>;
  delayMs?: number;
  maxAttempts?: number;
  transaction?: Prisma.TransactionClient;
};

export type TransactionalEnqueueJob = <T extends JobType>(
  params: Omit<EnqueueJobParams<T>, "transaction">,
) => Promise<void>;

export type JobHandlerContext = {
  runAppTransaction: RunAppTransaction;
};

export interface JobQueue {
  enqueue: <T extends JobType>(params: EnqueueJobParams<T>) => Promise<Job>;
  schedule: (jobIds: string[]) => Promise<void>;

  start: (handlerContext: JobHandlerContext) => Promise<void>;
  stop: () => void;
}

export const jobQueue: JobQueue = new PersistentInMemoryJobQueue();
