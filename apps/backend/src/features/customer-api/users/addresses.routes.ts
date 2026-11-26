import { ShippingAddressSchema } from "@acme/shared/schemas/shippingAddress";
import { RouteError } from "@rest-rpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

import { customerAddressTable } from "#src/db/schema.ts";
import { customerRoute } from "#src/routing/base.ts";

const addressRoute = customerRoute.meta({ access: "AUTHENTICATED" });

const addressIdParams = z.object({
  addressId: z.coerce.number<number>().int().positive(),
});

const ownAddress = (addressId: number, customerId: number) =>
  and(eq(customerAddressTable.id, addressId), eq(customerAddressTable.customerId, customerId));

export const addressesRoutes = {
  list: addressRoute.get("/users/address").handler(async ({ context }) => {
    return await context.db.query.customerAddress.findMany({
      where: { customerId: context.authContext.customerId },
      orderBy: { id: "desc" },
    });
  }),

  create: addressRoute
    .post("/users/address")
    .body(ShippingAddressSchema)
    .handler(async ({ body, context }) => {
      const [address] = await context.db
        .insert(customerAddressTable)
        .values({ customerId: context.authContext.customerId, ...body })
        .returning();

      return address;
    }),

  update: addressRoute
    .patch("/users/address/:addressId")
    .params(addressIdParams)
    .body(ShippingAddressSchema)
    .handler(async ({ params, body, context }) => {
      const [address] = await context.db
        .update(customerAddressTable)
        .set(body)
        .where(ownAddress(params.addressId, context.authContext.customerId))
        .returning();

      if (!address) throw new RouteError("NOT_FOUND", { status: 404 });
      return address;
    }),

  delete: addressRoute
    .delete("/users/address/:addressId")
    .params(addressIdParams)
    .handler(async ({ params, context }) => {
      const [deleted] = await context.db
        .delete(customerAddressTable)
        .where(ownAddress(params.addressId, context.authContext.customerId))
        .returning({ id: customerAddressTable.id });
      if (!deleted) throw new RouteError("NOT_FOUND", { status: 404 });
    }),
};
