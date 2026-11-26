import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { eq } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import { adminAccountTable, userTable } from "#src/db/schema.ts";

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

await db.transaction(async (tx) => {
  await tx.insert(userTable).values({ clerk_id: clerkId }).onConflictDoNothing();
  await tx.delete(adminAccountTable).where(eq(adminAccountTable.user_id, clerkId));
  await tx.insert(adminAccountTable).values({ user_id: clerkId });
});

await db.$client.end();
