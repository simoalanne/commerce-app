import { RouteError } from "@rest-rpc/server";
import { z } from "zod";

import type { EnvConfig } from "#src/config.ts";
import type { Db } from "#src/db/client.ts";
import { createSignedJwt, verifyJwtToken } from "#src/utils/jwtUtils.ts";

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
    throw new RouteError("NOT_FOUND", { status: 404 });
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
  { db, config }: { db: Db; config: EnvConfig },
  { token, orderId, customerId, scope }: CreateOrderCapabilityParams,
) => {
  const whereClause = orderId ? { id: orderId, customerId } : { claimToken: token };
  const order = await db.query.order.findFirst({
    where: whereClause,
    columns: {
      id: true,
    },
  });

  if (!order) {
    throw new RouteError("NOT_FOUND", { status: 404 });
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
