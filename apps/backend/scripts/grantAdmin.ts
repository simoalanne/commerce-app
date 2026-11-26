import "dotenv/config";
import { createClerkClient } from "@clerk/backend";

import prismaClient from "#src/prisma.ts";

const identifier = process.argv[2]?.trim();

if (!identifier) {
  console.error("Usage: pnpm --filter backend grantAdmin <clerk_id_or_email>");
  process.exit(1);
}

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

let clerkId = identifier;

try {
  if (identifier.includes("@")) {
    const users = await clerkClient.users.getUserList({
      emailAddress: [identifier],
    });
    if (users.data.length === 0) {
      console.error(`No Clerk user found with email "${identifier}".`);
      process.exit(1);
    }
    if (users.data.length > 1) {
      console.error(
        `Multiple Clerk users found with email "${identifier}". Please use Clerk ID instead.`,
      );
      process.exit(1);
    }
    clerkId = users.data[0].id;
    console.log(`Found user by email: ${identifier} -> ${clerkId}`);
  } else {
    await clerkClient.users.getUser(clerkId);
  }
} catch {
  console.error(
    `No Clerk user found with identifier "${identifier}". Check for typos - refusing to create an account for a non-existent user.`,
  );
  process.exit(1);
}

await prismaClient.$transaction(async (tx) => {
  await tx.user.upsert({
    where: { clerk_id: clerkId },
    update: {},
    create: { clerk_id: clerkId },
  });

  await tx.adminAccount.deleteMany({
    where: { user_id: clerkId },
  });

  await tx.adminAccount.create({
    data: {
      user_id: clerkId,
    },
  });
});

await prismaClient.$disconnect();
