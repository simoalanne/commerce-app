import { and, count, eq, notInArray, sql, sum } from "drizzle-orm";
import z from "zod";

import { customerAccountTable, orderTable } from "#src/db/schema.ts";
import logger from "#src/logger.ts";
import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const customerRoute = dashboardRoute.meta({ access: "ADMIN" });

export const customersRoutes = {
  getAll: customerRoute
    .get("/customers")
    .query(
      z.object({
        customerId: z.coerce.number<number>().int().positive().optional(),
      }),
    )
    .handler(async ({ query, context }) => {
      const customers = await context.db
        .select({
          id: customerAccountTable.id,
          clerkId: customerAccountTable.userId,
          orderCount: count(orderTable.id),
          lifetimeValueCents:
            sql<number>`coalesce(${sum(orderTable.chargedTotalCents)}, 0)`.mapWith(Number),
          latestOrderCity: sql<
            string | null
          >`(array_agg(${orderTable.orderDetails}->'delivery'->>'city' ORDER BY ${orderTable.createdAt} DESC))[1]`,
        })
        .from(customerAccountTable)
        .leftJoin(
          orderTable,
          and(
            eq(orderTable.customerId, customerAccountTable.id),
            notInArray(orderTable.status, ["PENDING", "EXPIRED"]),
          ),
        )
        .where(query.customerId ? eq(customerAccountTable.id, query.customerId) : undefined)
        .groupBy(customerAccountTable.id);

      if (customers.length === 0) {
        return toResponse([], context.locale);
      }

      const clerkIds = customers.map((customer) => customer.clerkId);
      const authUsers = await context.auth.getUsersByIds(clerkIds);
      const clerkUserById = new Map(authUsers.map((user) => [user.id, user] as const));

      return toResponse(
        customers
          .filter((customer) => {
            const exists = clerkUserById.has(customer.clerkId);
            if (!exists) {
              logger.warn(
                `Customer with id ${customer.id} has Clerk id ${customer.clerkId} which does not exist in Clerk. This customer will be skipped.`,
              );
            }
            return exists;
          })
          .map(({ clerkId, ...customer }) => {
            const clerkUser = clerkUserById.get(clerkId)!;
            return {
              ...customer,
              email: clerkUser.email,
              fullName: clerkUser.fullName ?? clerkUser.email,
            };
          }),
        context.locale,
      );
    }),

  // TODO: implement this once we actually have detailed data for customers.
  // right now we wouldn't be able to return anything that differs from the getAll endpoint
  getById: customerRoute
    .get("/customers/:id")
    .params(
      z.object({
        id: z.coerce.number<number>().int().positive(),
      }),
    )
    .handler(async () => {}),
};
