import z from "zod";

import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const searchQuery = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters"),
});

export const searchRoutes = {
  query: customerRoute
    .get("/search")
    .query(searchQuery)
    .handler(async ({ query, context }) => {
      return toResponse(
        await context.search.search({
          q: query.q,
          locale: context.locale,
          limit: 10,
        }),
        context.locale,
      );
    }),

  getInitialData: customerRoute.get("/search/initialData").handler(async ({ context }) => {
    return toResponse(
      await context.search.getInitialData({
        locale: context.locale,
        limit: 10,
      }),
      context.locale,
    );
  }),
};
