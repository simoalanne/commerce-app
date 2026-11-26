import { after } from "node:test";

import prismaClient from "#src/prisma.ts";

after(async () => {
  await prismaClient.$disconnect();
});
