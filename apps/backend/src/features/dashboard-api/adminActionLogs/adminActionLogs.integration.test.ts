import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import {
  adminAccountTable,
  adminActionLogTable,
  customerAccountTable,
  tagTable,
  userTable,
} from "#src/db/schema.ts";
import { dashboardRouter } from "#src/routes.ts";
import type { AppContext } from "#src/routing/base.ts";
import { createTestClient } from "#src/tests/createTestClient.ts";

const clerkId = `user_${randomUUID()}`;
const email = "admin@example.com";

// Only the part of auth these routes use; the cast is the stub boundary.
const auth = {
  authenticateUser: async () => clerkId,
  getUsersByIds: async (ids: string[]) =>
    ids.map((id) => ({ id, email, firstName: null, lastName: null, fullName: "" })),
} as unknown as AppContext["auth"];

const client = createTestClient(dashboardRouter, { auth });

let adminAccountId: number;

beforeAll(async () => {
  await db.insert(userTable).values({ clerkId });
  await db.insert(customerAccountTable).values({ userId: clerkId });
  [{ id: adminAccountId }] = await db
    .insert(adminAccountTable)
    .values({ userId: clerkId })
    .returning({ id: adminAccountTable.id });
});

afterAll(async () => {
  await db
    .delete(adminActionLogTable)
    .where(eq(adminActionLogTable.adminAccountId, adminAccountId));
  await db.delete(userTable).where(eq(userTable.clerkId, clerkId));
});

describe("admin action log", () => {
  it("logs a dashboard write with its outcome, and a failed one after rollback", async () => {
    const { body: created } = await client.tags.create({
      body: { name: "Logged", color: "#22c55e" },
    });
    await client.tags
      .update({ params: { id: 0x7fffffff }, body: { name: "x", color: "#000000" } })
      .catch(() => {});
    await db.delete(tagTable).where(eq(tagTable.id, created.id));

    const { body: logs } = await client.adminActionLogs.getAll();
    const ours = logs.filter((log) => log.adminAccountId === adminAccountId);

    expect(ours).toMatchObject([
      {
        adminEmail: email,
        route: "PUT /api/dashboard/tags/:id",
        params: { id: 0x7fffffff },
        status: 404,
        result: { code: "NOT_FOUND" },
      },
      {
        adminEmail: email,
        route: "POST /api/dashboard/tags",
        body: { name: "Logged", color: "#22c55e" },
        status: 200,
        result: { id: created.id },
      },
    ]);
  });
});
