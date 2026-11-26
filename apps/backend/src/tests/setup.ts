import { afterAll } from "vitest";

import prismaClient from "#src/prisma.ts";

afterAll(async () => {
  await prismaClient.$disconnect();
});
