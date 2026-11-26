import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import envConfig from "./config.ts";

const connectionString = envConfig.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });

export default new PrismaClient({ adapter });
