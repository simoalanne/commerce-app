import prismaClient from "#src/prisma.ts";

import { bootstrapTestDatabase } from "./utils.ts";

export const globalSetup = async () => {
  await bootstrapTestDatabase();
};

export const globalTeardown = async () => {
  await prismaClient.$disconnect();
};
