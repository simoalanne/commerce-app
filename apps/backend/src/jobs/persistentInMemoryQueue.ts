import type { Job } from "@prisma/client";
import * as Sentry from "@sentry/node";

import envConfig from "#src/config.ts";
import logger from "#src/logger.ts";
import prismaClient from "#src/prisma.ts";

import { type JobType, jobDefinitions } from "./jobDefinitions.ts";
import type { EnqueueJobParams, JobHandlerContext, JobQueue } from "./queue.ts";

const MINUTE_MS = 60 * 1000;

// We are using a fixed retry delay schedule for failed jobs.
// Values are chosen with the assumption that 99% of jobs will
// succeed on the first attempt, and for the jobs that fail, we
// assume they will not magically succeed on the next attempt
// if that attempt is made immediately. So intentionally choosing
// a longer delay for the rare failures to give time for the underlying
// issue to be resolved before retrying.
const retryDelayMinutesByFailedAttempt = [5, 15, 60] as const;

/**
 * **PersistentInMemoryJobQueue** is a hybrid job queue implementation that
 * schedules and runs jobs in the node process memory, but persists job state in the database.
 *
 * This avoids polling the database for jobs, while still persisting job state so
 * when the node process restarts, it can resume pending jobs. The idea is to run
 * this inside the backend server process to avoid separate workers and to avoid the
 * complexity of a distributed job queue.
 *
 * This implementation is suitable for single instance deployment of the backend with a small
 * number of jobs. If the application ever grows beyond that a more robust but more complex job
 * queue implementation should be used.
 */
export class PersistentInMemoryJobQueue implements JobQueue {
  private readonly concurrencyLimit = 5;
  private isRunning = false;
  private timers = new Map<string, NodeJS.Timeout>();
  private activeJobCount = 0;
  private readyJobs: Job[] = [];
  private handlerContext: JobHandlerContext | null = null;

  async enqueue<T extends JobType>({
    type,
    payload,
    delayMs = 0,
    maxAttempts,
    transaction,
  }: EnqueueJobParams<T>) {
    const nextRunAt = new Date(Date.now() + delayMs);
    const client = transaction ?? prismaClient;
    return client.job.create({
      data: {
        type,
        payload,
        max_attempts: maxAttempts,
        next_run_at: nextRunAt,
      },
    });
  }

  async schedule(jobIds: string[]) {
    if (jobIds.length === 0) return;

    const jobs = await prismaClient.job.findMany({
      where: {
        id: {
          in: jobIds,
        },
      },
      orderBy: {
        next_run_at: "asc",
      },
    });

    for (const job of jobs) {
      this.scheduleJob(job);
    }
  }

  async start(handlerContext: JobHandlerContext) {
    if (this.isRunning) return;

    this.handlerContext = handlerContext;
    this.isRunning = true;

    await this.hydrateJobsOnStartup();
    const jobs = await prismaClient.job.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        next_run_at: "asc",
      },
    });

    for (const job of jobs) {
      this.scheduleJob(job);
    }

    logger.info("Background job queue started", {
      tag: "job-queue",
      scheduledJobs: jobs.length,
    });
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
    this.readyJobs = [];
    this.activeJobCount = 0;

    logger.info("Background job queue stopped", {
      tag: "job-queue",
    });
  }

  private scheduleJob(job: Job) {
    if (!this.isRunning || job.status === "COMPLETED" || job.status === "FAILED") {
      return;
    }

    const existingTimer = this.timers.get(job.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delayMs = Math.max(0, job.next_run_at.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(job.id);
      this.readyJobs.push(job);
      this.processReadyJobs();
    }, delayMs);

    this.timers.set(job.id, timer);
  }

  private async hydrateJobsOnStartup() {
    await prismaClient.job.updateMany({
      where: {
        status: "RUNNING",
      },
      data: {
        status: "PENDING",
        next_run_at: new Date(),
      },
    });

    const expiryDelayMs = envConfig.PENDING_ORDER_EXPIRY_MINUTES * MINUTE_MS;

    // Treat only runnable expiry jobs as satisfying startup repair.
    // Even if a previous expiry job reached FAILED, a still-PENDING order should
    // get another expiry attempt so stock is not reserved indefinitely.
    // this is not consistent with the general job queue behavior, but is a pragmatic choice
    // to satisfy the business requirement over correctness of the queue implementation.
    const pendingOrdersMissingExpiryJob = await prismaClient.$queryRaw<
      Array<{ id: number; created_at: Date }>
    >`
			SELECT o.id, o.created_at
			FROM "Order" o
			WHERE o.status = 'PENDING'
				AND NOT EXISTS (
					SELECT 1
					FROM "Job" j
					WHERE j.type = 'expirePendingOrder'
					  AND j.status IN ('PENDING', 'RUNNING')
						AND j.payload @> jsonb_build_object('orderId', o.id)
				)
		`;

    if (pendingOrdersMissingExpiryJob.length === 0) return;

    await prismaClient.job.createMany({
      data: pendingOrdersMissingExpiryJob.map((order) => ({
        type: "expirePendingOrder",
        payload: { orderId: order.id },
        next_run_at: new Date(order.created_at.getTime() + expiryDelayMs),
      })),
    });
  }

  private processReadyJobs() {
    while (
      this.isRunning &&
      this.activeJobCount < this.concurrencyLimit &&
      this.readyJobs.length > 0
    ) {
      const job = this.readyJobs.shift();
      if (!job) return;

      this.activeJobCount++;
      void this.processJob(job)
        .catch((error) => {
          logger.error("Background job processing failed outside retry handler", {
            tag: "job-queue",
            jobId: job.id,
            type: job.type,
            error: error instanceof Error ? (error.stack ?? error.message) : String(error),
          });

          Sentry.captureException(error, (scope) => {
            scope.setContext("job", {
              jobId: job.id,
              type: job.type,
            });

            return scope;
          });
        })
        .finally(() => {
          this.activeJobCount = Math.max(0, this.activeJobCount - 1);
          this.processReadyJobs();
        });
    }
  }

  private processJob(job: Job) {
    return Sentry.withIsolationScope(() => this.processJobAttempt(job));
  }

  private async processJobAttempt(job: Job) {
    const attempt = job.attempts + 1;

    const claim = await prismaClient.job.updateMany({
      where: {
        id: job.id,
        status: "PENDING",
      },
      data: {
        status: "RUNNING",
        attempts: attempt,
        last_error: null,
      },
    });

    if (claim.count === 0) {
      logger.warn("Skipping background job because it was already claimed", {
        tag: "job-queue",
        jobId: job.id,
        type: job.type,
      });
      return;
    }

    try {
      await this.runHandler({
        type: job.type,
        payload: job.payload,
      });

      await prismaClient.job.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          last_error: null,
        },
      });
    } catch (error) {
      const lastError = error instanceof Error ? (error.stack ?? error.message) : String(error);
      const hasAttemptsRemaining = attempt < job.max_attempts;
      const retryDelayMinutes =
        retryDelayMinutesByFailedAttempt[
          Math.min(attempt - 1, retryDelayMinutesByFailedAttempt.length - 1)
        ];
      const nextRunAt = hasAttemptsRemaining
        ? new Date(Date.now() + retryDelayMinutes * MINUTE_MS)
        : job.next_run_at;

      const updatedJob = await prismaClient.job.update({
        where: { id: job.id },
        data: {
          status: hasAttemptsRemaining ? "PENDING" : "FAILED",
          attempts: attempt,
          last_error: lastError,
          next_run_at: nextRunAt,
        },
      });

      logger.error("Background job failed", {
        tag: "job-queue",
        jobId: job.id,
        type: job.type,
        attempt,
        maxAttempts: job.max_attempts,
        willRetry: hasAttemptsRemaining,
        error: lastError,
      });

      Sentry.captureException(error, (scope) => {
        scope.setContext("job", {
          jobId: job.id,
          type: job.type,
          attempt,
          maxAttempts: job.max_attempts,
          willRetry: hasAttemptsRemaining,
        });

        return scope;
      });

      if (hasAttemptsRemaining) {
        this.scheduleJob(updatedJob);
      }
    }
  }

  private async runHandler({ type, payload: rawPayload }: { type: string; payload: unknown }) {
    const definition = jobDefinitions[type as JobType];

    if (!definition) {
      logger.warn("Skipping unknown background job type", {
        tag: "job-queue",
        type,
      });
      return;
    }

    const parsedPayload = definition.schema.parse(rawPayload);
    const handler = definition.handler as (
      payload: typeof parsedPayload,
      context: JobHandlerContext,
    ) => Promise<void>;

    if (!this.handlerContext) {
      throw new Error("Background job handler context is not configured");
    }

    await handler(parsedPayload, this.handlerContext);
  }
}
