import { DeliveryInstructionsSchema } from "@acme/shared/schemas";
import type { CustomerAddress } from "@prisma/client";
import z from "zod";

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
  street_number: body.streetNumber,
  postal_code: body.postalCode,
  city: body.city,
  delivery_details: {
    addressType: body.addressType,
    entrance: body.entrance,
    floor: body.floor,
    apartment: body.apartment,
    deliveryInstructions: body.deliveryInstructions,
  },
});

const toAddressResponse = (address: CustomerAddress) => ({
  id: address.id,
  street: address.street,
  streetNumber: address.street_number,
  postalCode: address.postal_code,
  city: address.city,
  addressType: address.delivery_details.addressType ?? null,
  entrance: address.delivery_details.entrance ?? null,
  floor: address.delivery_details.floor ?? null,
  apartment: address.delivery_details.apartment ?? null,
  deliveryInstructions: address.delivery_details.deliveryInstructions ?? {},
});

export const addressesRoutes = {
  list: addressRoute.get("/users/address").handler(async ({ context }) => {
    const addresses = await context.db.customerAddress.findMany({
      where: { customer_id: context.authContext.customerId },
      orderBy: { id: "desc" },
    });

    return toResponse(addresses.map(toAddressResponse), context.locale);
  }),

  create: addressRoute
    .post("/users/address")
    .body(addressBody)
    .handler(async ({ body, context }) => {
      const address = await context.db.customerAddress.create({
        data: {
          customer_id: context.authContext.customerId,
          ...toAddressData(body),
        },
      });

      return toResponse(toAddressResponse(address), context.locale);
    }),

  update: addressRoute
    .patch("/users/address/:addressId")
    .params(addressIdParams)
    .body(addressBody)
    .handler(async ({ params, body, context }) => {
      const address = await context.db.customerAddress.update({
        where: { id: params.addressId, customer_id: context.authContext.customerId },
        data: toAddressData(body),
      });

      return toResponse(toAddressResponse(address), context.locale);
    }),

  delete: addressRoute
    .delete("/users/address/:addressId")
    .params(addressIdParams)
    .handler(async ({ params, context }) => {
      await context.db.customerAddress.delete({
        where: {
          id: params.addressId,
          customer_id: context.authContext.customerId,
        },
      });
    }),
};
