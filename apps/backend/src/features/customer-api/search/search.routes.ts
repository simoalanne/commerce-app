import z from "zod";

import { customerRoute } from "#src/routing/base.ts";

const searchQuery = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters"),
});

export const searchRoutes = {
  query: customerRoute
    .get("/search")
    .query(searchQuery)
    .handler(async ({ query, context }) => {
      return await context.search.search({
        q: query.q,
        locale: context.locale,
        limit: 10,
      });
    }),

  getInitialData: customerRoute.get("/search/initialData").handler(async ({ context }) => {
    return await context.search.getInitialData({
      locale: context.locale,
      limit: 10,
    });
  }),
};
