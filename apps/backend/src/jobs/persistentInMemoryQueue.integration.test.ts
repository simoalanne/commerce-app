import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";

import { afterEach, describe, it, vi } from "vitest";
import z from "zod";

import prismaClient from "#src/prisma.ts";
import { createOrder } from "#src/tests/factories.ts";

import { PersistentInMemoryJobQueue } from "./persistentInMemoryQueue.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate: () => Promise<boolean>) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 1000) {
    if (await predicate()) return;
    await sleep(10);
  }

  throw new Error("Timed out waiting for queue state");
};

const mockRunAppTransaction = (() => Promise.resolve()) as any;
const createdJobIds = new Set<string>();
const createdOrderIds = new Set<number>();

type SentryContext = Map<string, unknown>;

type SentryScopeMock = {
  setContext: (name: string, value: unknown) => SentryScopeMock;
};

const createSentryIsolationContractMock = () => {
  const contextStorage = new AsyncLocalStorage<SentryContext>();
  const sharedContext = new Map<string, unknown>();
  const capturedEvents: SentryContext[] = [];

  const createScope = (context: SentryContext): SentryScopeMock => {
    const scope: SentryScopeMock = {
      setContext(name, value) {
        context.set(name, value);
        return scope;
      },
    };
    return scope;
  };

  // Sentry uses AsyncLocalStorage to carry isolated scopes across awaits.
  // Capture callbacks receive an event-local clone of the ambient scope.
  const sentry = {
    withIsolationScope<T>(callback: () => T) {
      return contextStorage.run(new Map(contextStorage.getStore() ?? sharedContext), callback);
    },
    getCurrentScope() {
      return createScope(contextStorage.getStore() ?? sharedContext);
    },
    captureException(
      _error: unknown,
      configureScope?: (scope: SentryScopeMock) => SentryScopeMock,
    ) {
      const eventContext = new Map(contextStorage.getStore() ?? sharedContext);
      configureScope?.(createScope(eventContext));
      capturedEvents.push(eventContext);
      return "event-id";
    },
  };

  return { sentry, capturedEvents };
};

const createTrackedJob = async (args: Parameters<typeof prismaClient.job.create>[0]) => {
  const job = await prismaClient.job.create(args);
  createdJobIds.add(job.id);
  return job;
};

const createTrackedOrder = async (overrides: Parameters<typeof createOrder>[0]) => {
  const order = await createOrder(overrides);
  createdOrderIds.add(order.id);
  return order;
};

const loadQueueWithThrowingHandler = async () => {
  vi.resetModules();
  vi.doMock("./jobDefinitions.ts", () => ({
    jobDefinitions: {
      throwingJob: {
        schema: z.object({
          id: z.number(),
        }),
        handler: async () => {
          throw new Error("handler failed");
        },
      },
    },
  }));
  return import("./persistentInMemoryQueue.ts");
};

afterEach(async () => {
  if (createdJobIds.size > 0) {
    await prismaClient.job.deleteMany({
      where: {
        id: { in: [...createdJobIds] },
      },
    });
    createdJobIds.clear();
  }

  for (const orderId of createdOrderIds) {
    await prismaClient.job.deleteMany({
      where: {
        type: "expirePendingOrder",
        payload: {
          path: ["orderId"],
          equals: orderId,
        },
      },
    });
  }

  if (createdOrderIds.size > 0) {
    await prismaClient.order.deleteMany({
      where: { id: { in: [...createdOrderIds] } },
    });
    createdOrderIds.clear();
  }
});

describe("PersistentInMemoryJobQueue", () => {
  it("requeues jobs left running on startup", async () => {
    const queue = new PersistentInMemoryJobQueue();
    const originalNextRunAt = new Date(Date.now() + 60_000);
    const job = await createTrackedJob({
      data: {
        type: "sendOrderConfirmationEmail",
        payload: { orderId: 123 },
        status: "RUNNING",
        next_run_at: originalNextRunAt,
      },
    });

    const beforeStart = Date.now();
    await queue.start(mockRunAppTransaction);
    queue.stop();

    const updatedJob = await prismaClient.job.findUniqueOrThrow({
      where: { id: job.id },
    });

    assert.strictEqual(updatedJob.status, "PENDING");
    assert.ok(updatedJob.next_run_at.getTime() >= beforeStart);
    assert.ok(updatedJob.next_run_at.getTime() < originalNextRunAt.getTime());
  });

  it("creates another expiry job for pending orders with only failed expiry jobs", async () => {
    const queue = new PersistentInMemoryJobQueue();
    const order = await createTrackedOrder({ status: "PENDING" });
    await createTrackedJob({
      data: {
        type: "expirePendingOrder",
        payload: { orderId: order.id },
        status: "FAILED",
        attempts: 3,
        max_attempts: 3,
      },
    });

    await queue.start(mockRunAppTransaction);
    queue.stop();

    const expiryJobs = await prismaClient.job.findMany({
      where: {
        type: "expirePendingOrder",
        payload: {
          path: ["orderId"],
          equals: order.id,
        },
      },
      orderBy: { created_at: "asc" },
    });

    assert.strictEqual(expiryJobs.length, 2);
    assert.strictEqual(expiryJobs[0].status, "FAILED");
    assert.strictEqual(expiryJobs[1].status, "PENDING");
  });

  it("does not duplicate pending expiry jobs on startup", async () => {
    const queue = new PersistentInMemoryJobQueue();
    const order = await createTrackedOrder({ status: "PENDING" });
    await createTrackedJob({
      data: {
        type: "expirePendingOrder",
        payload: { orderId: order.id },
        status: "PENDING",
        next_run_at: new Date(Date.now() + 60_000),
      },
    });

    await queue.start(mockRunAppTransaction);
    queue.stop();

    const expiryJobCount = await prismaClient.job.count({
      where: {
        type: "expirePendingOrder",
        payload: {
          path: ["orderId"],
          equals: order.id,
        },
      },
    });

    assert.strictEqual(expiryJobCount, 1);
  });

  it("retries failed jobs with a delay while attempts remain", async () => {
    const { PersistentInMemoryJobQueue: QueueWithThrowingHandler } =
      await loadQueueWithThrowingHandler();
    const queue = new QueueWithThrowingHandler();
    const job = await createTrackedJob({
      data: {
        type: "throwingJob",
        payload: { id: 1 },
        status: "PENDING",
        attempts: 0,
        max_attempts: 3,
        next_run_at: new Date(),
      },
    });

    await queue.start(mockRunAppTransaction);
    await waitFor(async () => {
      const updatedJob = await prismaClient.job.findUniqueOrThrow({
        where: { id: job.id },
      });
      return updatedJob.attempts === 1 && updatedJob.status === "PENDING";
    });
    queue.stop();

    const updatedJob = await prismaClient.job.findUniqueOrThrow({
      where: { id: job.id },
    });

    assert.strictEqual(updatedJob.status, "PENDING");
    assert.strictEqual(updatedJob.attempts, 1);
    assert.match(updatedJob.last_error ?? "", /handler failed/);
    assert.ok(updatedJob.next_run_at.getTime() > Date.now());
  });

  it("marks failed jobs terminal when max attempts are exhausted", async () => {
    const { PersistentInMemoryJobQueue: QueueWithThrowingHandler } =
      await loadQueueWithThrowingHandler();
    const queue = new QueueWithThrowingHandler();
    const job = await createTrackedJob({
      data: {
        type: "throwingJob",
        payload: { id: 1 },
        status: "PENDING",
        attempts: 2,
        max_attempts: 3,
        next_run_at: new Date(),
      },
    });

    await queue.start(mockRunAppTransaction);
    await waitFor(async () => {
      const updatedJob = await prismaClient.job.findUniqueOrThrow({
        where: { id: job.id },
      });
      return updatedJob.attempts === 3 && updatedJob.status === "FAILED";
    });
    queue.stop();

    const updatedJob = await prismaClient.job.findUniqueOrThrow({
      where: { id: job.id },
    });

    assert.strictEqual(updatedJob.status, "FAILED");
    assert.strictEqual(updatedJob.attempts, 3);
    assert.match(updatedJob.last_error ?? "", /handler failed/);
  });

  it("isolates Sentry context between concurrently processed jobs", async () => {
    const { sentry, capturedEvents } = createSentryIsolationContractMock();
    let arrivedJobCount = 0;
    let releaseJobs!: () => void;
    const bothJobsArrived = new Promise<void>((resolve) => {
      releaseJobs = resolve;
    });
    const waitForBothJobs = async () => {
      arrivedJobCount++;
      if (arrivedJobCount === 2) releaseJobs();
      await bothJobsArrived;
    };

    vi.resetModules();
    vi.doMock("@sentry/node", () => sentry);
    vi.doMock("./jobDefinitions.ts", () => ({
      jobDefinitions: {
        contextJob: {
          schema: z.object({
            orderId: z.number(),
          }),
          handler: async ({ orderId }: { orderId: number }) => {
            sentry.getCurrentScope().setContext("order", { orderId });
            await waitForBothJobs();
            throw new Error(`Order ${orderId} failed`);
          },
        },
      },
    }));
    const { PersistentInMemoryJobQueue: QueueWithContextHandler } =
      await import("./persistentInMemoryQueue.ts");
    const queue = new QueueWithContextHandler();

    await Promise.all(
      [100, 200].map((orderId) =>
        createTrackedJob({
          data: {
            type: "contextJob",
            payload: { orderId },
            max_attempts: 1,
            next_run_at: new Date(),
          },
        }),
      ),
    );

    await queue.start(mockRunAppTransaction);
    await waitFor(async () => Promise.resolve(capturedEvents.length === 2));
    queue.stop();

    assert.deepStrictEqual(
      capturedEvents
        .map((context) => z.object({ orderId: z.number() }).parse(context.get("order")).orderId)
        .sort((a, b) => a - b),
      [100, 200],
    );

    for (const context of capturedEvents) {
      const jobContext = z
        .object({
          jobId: z.string(),
          type: z.string(),
          attempt: z.number(),
          maxAttempts: z.number(),
          willRetry: z.boolean(),
        })
        .parse(context.get("job"));
      assert.ok(createdJobIds.has(jobContext.jobId));
      assert.deepStrictEqual(jobContext, {
        jobId: jobContext.jobId,
        type: "contextJob",
        attempt: 1,
        maxAttempts: 1,
        willRetry: false,
      });
    }
  });
});
