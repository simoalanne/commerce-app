import prismaClient from "#src/prisma.ts";

const truncateAllTablesSql = `
TRUNCATE TABLE
	"AdminAccount",
	"Order",
	"CustomerAddress",
	"CustomerAccount",
	"Review",
	"Product",
	"Category",
	"Vendor",
	"Job",
	"WebhookSubscription",
	"User"
RESTART IDENTITY CASCADE;
`;

const isTestDatabaseConnectionFailure = (error: Record<string, unknown>) => {
  const likelyErrorCodesForConnectionFailure = [
    "ECONNREFUSED",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "EPIPE",
  ];
  return likelyErrorCodesForConnectionFailure.includes(error.code as string);
};

export const bootstrapTestDatabase = async () => {
  try {
    await prismaClient.$executeRawUnsafe(truncateAllTablesSql);
  } catch (cause) {
    if (isTestDatabaseConnectionFailure(cause as Record<string, unknown>)) {
      throw new Error(
        `Failed to connect to the test database. Make sure the test database is running and accessible.
				You can start the test db using with docker compose in the backend directory"`,
        { cause },
      );
    }

    throw new Error(
      `Failed to bootstrap the test database. Try running pnpm test:db:init to sync with the latest prisma schema. 
			If problem persists, check the raw error for more details.`,
      { cause },
    );
  }
};
