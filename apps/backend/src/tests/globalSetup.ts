import prismaClient from "#src/prisma.ts";

import { bootstrapTestDatabase } from "./utils.ts";

export const setup = async () => {
  await bootstrapTestDatabase();
};

export const teardown = async () => {
  await prismaClient.$disconnect();
};
