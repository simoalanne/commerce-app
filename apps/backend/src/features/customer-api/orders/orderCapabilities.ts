import type { Prisma } from "@prisma/client";
import { z } from "zod";

import type { EnvConfig } from "#src/config.ts";
import { createSignedJwt, verifyJwtToken } from "#src/utils/jwtUtils.ts";
import { NotFoundError } from "#src/utils/notFoundError.ts";

const OrderCapabilityPayloadSchema = z.object({
  typ: z.literal("order-capability"),
  orderId: z.number().int().positive(),
  scope: z.enum(["order:read", "order:review"]),
  exp: z.number().int().positive().optional(),
});

export const verifyOrderCapabilityJwt = async (
  config: EnvConfig,
  {
    token,
    scope,
  }: {
    token: string;
    scope: "order:read" | "order:review";
  },
) => {
  const payload = await verifyJwtToken(config, token, OrderCapabilityPayloadSchema);

  if (!payload || payload.scope !== scope) {
    throw new NotFoundError();
  }

  return {
    orderId: payload.orderId,
  };
};

type CreateOrderCapabilityParams = { scope: "order:read" | "order:review" } & (
  | { orderId: number; customerId: number; token?: never }
  | { token: string; orderId?: never; customerId?: never }
);

export const createOrderCapabilityJwt = async (
  { db, config }: { db: Prisma.TransactionClient; config: EnvConfig },
  { token, orderId, customerId, scope }: CreateOrderCapabilityParams,
) => {
  const whereClause = orderId ? { id: orderId, customer_id: customerId } : { claim_token: token };
  const order = await db.order.findFirst({
    where: whereClause,
    select: {
      id: true,
    },
  });

  if (!order) {
    throw new NotFoundError();
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const capability = await createSignedJwt(
    config,
    {
      typ: "order-capability",
      orderId: order.id,
      scope,
    },
    expiresAt,
  );

  return {
    orderId: order.id,
    accessToken: capability,
    expiresAt: expiresAt.toISOString(),
  };
};
