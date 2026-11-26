import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const jobQueueRoute = dashboardRoute.meta({ access: "ADMIN" });

const JOB_QUEUE_ENTRY_LIMIT = 1000;

// pg-boss stores a failed attempt's error as the job's output.
const getLastError = (output: unknown) => {
  if (typeof output !== "object" || output === null) return null;
  if ("stack" in output && typeof output.stack === "string") return output.stack;
  if ("message" in output && typeof output.message === "string") return output.message;
  return null;
};

export const jobQueueRoutes = {
  getAll: jobQueueRoute.get("/job-queue").handler(async ({ context }) => {
    const jobs = await context.jobQueue.listRecent(JOB_QUEUE_ENTRY_LIMIT);

    return toResponse(
      jobs.map((job) => ({
        id: job.id,
        type: job.type,
        state: job.state,
        retryCount: job.retryCount,
        retryLimit: job.retryLimit,
        startAfter: job.startAfter,
        createdAt: job.createdOn,
        completedAt: job.completedOn,
        payload: job.payload,
        lastError:
          job.state === "failed" || job.state === "retry" ? getLastError(job.output) : null,
      })),
    );
  }),
};
