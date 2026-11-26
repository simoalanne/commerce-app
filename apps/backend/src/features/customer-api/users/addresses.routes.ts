import { DeliveryInstructionsSchema } from "@acme/shared/schemas";
import { RouteError } from "@rest-rpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

import { customerAddressTable } from "#src/db/schema.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

const addressRoute = customerRoute.meta({ access: "AUTHENTICATED" });

const addressIdParams = z.object({
  addressId: z.coerce.number<number>().int().positive(),
});

const addressType = z
  .enum(["HOUSE", "APARTMENT"])
  .describe(
    "The type of the address, either a standalone house or an apartment within a building. Matters for UI only",
  )
  .nullable();

const addressBody = z.object({
  street: z.string().trim().min(1).max(255),
  city: z.string().trim().min(1).max(255),
  postalCode: z.string().trim().min(1).max(32),
  addressType,
  streetNumber: z.string().trim().max(64).nullable(),
  entrance: z.string().trim().max(64).nullable(),
  floor: z.string().trim().max(64).nullable(),
  apartment: z.string().trim().max(64).nullable(),
  deliveryInstructions: DeliveryInstructionsSchema,
});

const toAddressData = (body: z.output<typeof addressBody>) => ({
  street: body.street,
  streetNumber: body.streetNumber,
  postalCode: body.postalCode,
  city: body.city,
  deliveryDetails: {
    addressType: body.addressType,
    entrance: body.entrance,
    floor: body.floor,
    apartment: body.apartment,
    deliveryInstructions: body.deliveryInstructions,
  },
});

const toAddressResponse = (address: typeof customerAddressTable.$inferSelect) => ({
  id: address.id,
  street: address.street,
  streetNumber: address.streetNumber,
  postalCode: address.postalCode,
  city: address.city,
  addressType: address.deliveryDetails.addressType ?? null,
  entrance: address.deliveryDetails.entrance ?? null,
  floor: address.deliveryDetails.floor ?? null,
  apartment: address.deliveryDetails.apartment ?? null,
  deliveryInstructions: address.deliveryDetails.deliveryInstructions ?? {},
});

const ownAddress = (addressId: number, customerId: number) =>
  and(eq(customerAddressTable.id, addressId), eq(customerAddressTable.customerId, customerId));

export const addressesRoutes = {
  list: addressRoute.get("/users/address").handler(async ({ context }) => {
    const addresses = await context.db.query.customerAddress.findMany({
      where: { customerId: context.authContext.customerId },
      orderBy: { id: "desc" },
    });

    return toResponse(addresses.map(toAddressResponse), context.locale);
  }),

  create: addressRoute
    .post("/users/address")
    .body(addressBody)
    .handler(async ({ body, context }) => {
      const [address] = await context.db
        .insert(customerAddressTable)
        .values({
          customerId: context.authContext.customerId,
          ...toAddressData(body),
        })
        .returning();

      return toResponse(toAddressResponse(address), context.locale);
    }),

  update: addressRoute
    .patch("/users/address/:addressId")
    .params(addressIdParams)
    .body(addressBody)
    .handler(async ({ params, body, context }) => {
      const [address] = await context.db
        .update(customerAddressTable)
        .set(toAddressData(body))
        .where(ownAddress(params.addressId, context.authContext.customerId))
        .returning();

      if (!address) throw new RouteError("NOT_FOUND", { status: 404 });
      return toResponse(toAddressResponse(address), context.locale);
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
