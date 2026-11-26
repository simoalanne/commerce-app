import { db } from "#src/db/client.ts";

import { bootstrapTestDatabase } from "./utils.ts";

export const setup = async () => {
  await bootstrapTestDatabase();
};

export const teardown = async () => {
  await db.$client.end();
};
