import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const jobQueueRoute = dashboardRoute.meta({ access: "ADMIN" });

const JOB_QUEUE_ENTRY_LIMIT = 1000;

export const jobQueueRoutes = {
  getAll: jobQueueRoute.get("/job-queue").handler(async ({ context }) => {
    const jobs = await context.db.job.findMany({
      orderBy: {
        created_at: "desc",
      },
      take: JOB_QUEUE_ENTRY_LIMIT,
    });

    return toResponse(
      jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.max_attempts,
        nextRunAt: job.next_run_at,
        lastError: job.last_error,
        payload: job.payload,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      })),
    );
  }),
};
