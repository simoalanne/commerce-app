import z from "zod";

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
      const customers = await context.db.customerAccount.findMany({
        where: query.customerId ? { id: query.customerId } : undefined,
        include: {
          user: {
            select: {
              clerk_id: true,
            },
          },
          orders: {
            select: {
              charged_total_cents: true,
              order_details: true,
              created_at: true,
            },
            where: {
              status: {
                notIn: ["PENDING", "EXPIRED"],
              },
            },
            orderBy: {
              created_at: "desc",
            },
          },
        },
      });

      if (customers.length === 0) {
        return toResponse([], context.locale);
      }

      const clerkIds = customers.map((customer) => customer.user.clerk_id);
      const authUsers = await context.auth.getUsersByIds(clerkIds);
      const clerkUserById = new Map(authUsers.map((user) => [user.id, user] as const));

      return toResponse(
        customers
          .filter((customer) => {
            const exists = clerkUserById.has(customer.user.clerk_id);
            if (!exists) {
              logger.warn(
                `Customer with id ${customer.id} has clerk_id ${customer.user.clerk_id} which does not exist in Clerk. This customer will be skipped.`,
              );
            }
            return exists;
          })
          .map((customer) => {
            const latestOrder = customer.orders[0];
            const clerkUser = clerkUserById.get(customer.user.clerk_id)!;
            const latest_order_city = latestOrder?.order_details.delivery.city ?? null;
            const lifetime_value_cents = customer.orders.reduce(
              (sum, order) => sum + order.charged_total_cents,
              0,
            );

            return {
              id: customer.id,
              email: clerkUser.email,
              full_name: clerkUser.fullName ?? clerkUser.email,
              latest_order_city,
              order_count: customer.orders.length,
              lifetime_value_cents,
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
