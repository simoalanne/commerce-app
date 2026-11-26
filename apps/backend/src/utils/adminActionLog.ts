import { Prisma } from "@prisma/client";

import AuthProvider from "#src/integrations/auth/auth.provider.ts";
import type { AuthContext } from "#src/routing/auth.ts";

type LogAdminActionInputBase = {
  actor: AuthContext;
  action: "CREATE" | "UPDATE" | "DELETE" | "OTHER";
  entity: string;
  entityId?: number | string | null;
};

export type LogAdminActionInput = LogAdminActionInputBase &
  (
    | {
        details: Record<string, unknown>;
        before?: never;
        after?: never;
      }
    | {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        details?: never;
      }
  );

export const toSafeJsonValue = (value: unknown): Prisma.InputJsonValue | null | undefined => {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSafeJsonValue(item)) as Prisma.InputJsonArray;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, toSafeJsonValue(val)]),
  ) as Prisma.InputJsonObject;
};

export const getChangedFields = (
  before: Record<string, Prisma.InputJsonValue | null>,
  after: Record<string, Prisma.InputJsonValue | null>,
) => {
  const changedBefore: Record<string, Prisma.InputJsonValue | null> = {};
  const changedAfter: Record<string, Prisma.InputJsonValue | null> = {};
  const keys = Object.keys(before).filter((key) => key in after);

  for (const key of keys) {
    if (key === "updated_at") {
      continue;
    }

    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) {
      continue;
    }

    if (Array.isArray(before[key]) && Array.isArray(after[key])) {
      const beforeArray = before[key];
      const afterArray = after[key];
      const existingItemsUnchanged =
        afterArray.length > beforeArray.length &&
        beforeArray.every(
          (item, index) => JSON.stringify(item) === JSON.stringify(afterArray[index]),
        );

      if (existingItemsUnchanged) {
        changedBefore[key] = [];
        changedAfter[key] = afterArray.slice(beforeArray.length);
        continue;
      }
    }

    if (
      before[key] &&
      after[key] &&
      !Array.isArray(before[key]) &&
      !Array.isArray(after[key]) &&
      typeof before[key] === "object" &&
      typeof after[key] === "object"
    ) {
      const nestedChanges = getChangedFields(
        before[key] as Record<string, Prisma.InputJsonValue | null>,
        after[key] as Record<string, Prisma.InputJsonValue | null>,
      );

      if (
        Object.keys(nestedChanges.before).length > 0 ||
        Object.keys(nestedChanges.after).length > 0
      ) {
        changedBefore[key] = nestedChanges.before;
        changedAfter[key] = nestedChanges.after;
      }

      continue;
    }

    changedBefore[key] = before[key];
    changedAfter[key] = after[key];
  }

  return {
    before: changedBefore as Prisma.InputJsonObject,
    after: changedAfter as Prisma.InputJsonObject,
  };
};

export async function logAdminAction(db: Prisma.TransactionClient, input: LogAdminActionInput) {
  if (!input.actor.adminId) {
    throw new Error("Admin action logging requires an authenticated admin");
  }
  const identity = await AuthProvider.getUserById(input.actor.clerkId);

  let details: Prisma.InputJsonValue | null = null;

  if (input.details) {
    details = toSafeJsonValue(input.details) ?? null;
  }

  if (input.before || input.after) {
    const before = toSafeJsonValue(input.before);
    const after = toSafeJsonValue(input.after);

    if (input.action === "UPDATE" && before && after) {
      details = getChangedFields(
        before as Record<string, Prisma.InputJsonValue | null>,
        after as Record<string, Prisma.InputJsonValue | null>,
      );
    } else {
      details = {
        before: before ?? undefined,
        after: after ?? undefined,
      };
    }
  }

  await db.adminActionLog.create({
    data: {
      admin_account_id: input.actor.adminId,
      admin_email: identity.email,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId != null ? String(input.entityId) : null,
      details: details ?? Prisma.JsonNull,
    },
  });
}
