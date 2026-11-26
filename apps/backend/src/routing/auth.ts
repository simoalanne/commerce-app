import type { Prisma } from "@prisma/client";

import type { AuthProvider } from "#src/integrations/auth/auth.provider.ts";
import logger from "#src/logger.ts";
import type { RunAppTransaction } from "#src/utils/runAppTransaction.ts";

import { Forbidden, Unauthorized } from "./errors.ts";

export type AccessLevel = "AUTHENTICATED" | "OPTIONAL_AUTHENTICATED" | "ADMIN";

export type AuthContext = {
  isAuthenticated: boolean;
  clerkId: string;
  customerId: number;
  adminId: number | null;
};

type AuthDependencies = {
  headers: Headers;
  db: Prisma.TransactionClient;
  auth: AuthProvider;
  runAppTransaction: RunAppTransaction;
};

const userRecordSelect = {
  clerk_id: true,
  customer_account: { select: { id: true } },
  admin_account: { select: { id: true } },
} as const;

type LocalUserRecord = Prisma.UserGetPayload<{
  select: typeof userRecordSelect;
}>;

// Checked by code so this module needs no Prisma runtime import.
const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

const getOrCreateUserRecord = async (
  { db, auth, runAppTransaction }: Omit<AuthDependencies, "headers">,
  userId: string,
) => {
  const existingUser = await db.user.findUnique({
    where: { clerk_id: userId },
    select: userRecordSelect,
  });

  if (existingUser) {
    return existingUser;
  }

  const authUser = await auth.getUserById(userId);

  try {
    const createdUser = await runAppTransaction(async ({ tx }) => {
      const createdUser = await tx.user.create({
        data: {
          clerk_id: userId,
          customer_account: { create: {} },
        },
        select: userRecordSelect,
      });

      const normalizedEmail = authUser.email?.trim().toLowerCase();
      const customerAccountId = createdUser.customer_account?.id;
      if (!normalizedEmail || !customerAccountId) {
        return createdUser;
      }

      await tx.order.updateMany({
        where: {
          customer_id: null,
          has_been_linked_to_customer_account: false,
          order_details: {
            path: ["customer", "email"],
            equals: normalizedEmail,
          },
        },
        data: {
          customer_id: customerAccountId,
          has_been_linked_to_customer_account: true,
        },
      });

      return createdUser;
    });

    logger.info("Created local user from auth identity", {
      tag: "auth-sync",
      userId,
    });

    return createdUser;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const userRecord = await db.user.findUnique({
        where: { clerk_id: userId },
        select: userRecordSelect,
      });

      if (!userRecord) {
        throw new Error(
          "User create hit unique constraint but user still not found. Should be impossible",
          { cause: error },
        );
      }
      logger.warn(
        "Likely race condition during user creation - another request created the user after we checked but before we created",
        { userId },
      );
      return userRecord;
    }

    throw error;
  }
};

const tryBuildAuthContext = (
  accessLevel: AccessLevel,
  userRecord: LocalUserRecord,
): AuthContext | null => {
  const customerId = userRecord.customer_account?.id;

  if (!customerId) {
    throw new Error(
      "Authenticated user is missing customer record in DB, which should have been created automatically",
    );
  }

  const authContext = {
    isAuthenticated: true,
    clerkId: userRecord.clerk_id,
    customerId,
    adminId: userRecord.admin_account?.id ?? null,
  };

  if (accessLevel === "ADMIN" && !authContext.adminId) return null;

  return authContext;
};

const AccessLevelToRoleMap: { [K in AccessLevel]: string } = {
  AUTHENTICATED: "Any authenticated user",
  ADMIN: "Admin",
  OPTIONAL_AUTHENTICATED: "Any authenticated user",
};

const getUserCurrentRoles = (userRecord: LocalUserRecord) => {
  const roles: string[] = [];
  if (userRecord.customer_account) roles.push("Customer");
  if (userRecord.admin_account) roles.push("Admin");
  return roles.join(", ") || "No roles";
};

const createProxyAuthContext = () =>
  new Proxy({ isAuthenticated: false } as AuthContext, {
    get(_, prop) {
      if (prop === "isAuthenticated") {
        return false;
      }
      // Not thenable: resolveAuthContext is async, and resolving a promise
      // with this proxy reads `then`.
      if (prop === "then") {
        return undefined;
      }
      throw new Error(
        `Tried to access authContext.${String(prop)} on a route that does not require authentication. Please check isAuthenticated if authContext may not be available.`,
      );
    },
  });

/**
 * Resolves the `authContext` of a request for the route's access level.
 *
 * - Verifies that the request belongs to a valid authenticated Clerk session.
 * - Ensures the Clerk user exists in our database, creating the DB record on demand if needed.
 * - Rejects authenticated users who do not have the required app role for the route.
 *
 * Failure modes:
 * - `Unauthorized` (401) when the request has no valid authenticated Clerk session.
 * - `Forbidden` (403) when the user is authenticated but lacks the required application role.
 *
 * Special cases:
 * - if `accessLevel` is null, a proxy auth context is returned that throws on property access. This is to catch misuse of authContext
 *   where it should not be ever accessed like public routes, and to provide better error messages in case of such misuse.
 * - if `accessLevel` is "OPTIONAL_AUTHENTICATED" same rule applies except this does a best effort to return a usable authContext
 *   for authenticated users but does NOT throw if auth fails, allowing the handler to branch on `isAuthenticated`.
 */
export const resolveAuthContext = async (
  { headers, db, auth, runAppTransaction }: AuthDependencies,
  accessLevel: AccessLevel | null,
): Promise<AuthContext> => {
  if (!accessLevel) {
    return createProxyAuthContext();
  }
  const userId = await auth.authenticateUser(headers);
  if (!userId && accessLevel !== "OPTIONAL_AUTHENTICATED") {
    logger.error(
      "Unauthorized request - no valid Clerk session. Check your system time and Clerk status to rule out common issues.",
      { tag: "resolveAuthContext" },
    );
    throw new Unauthorized();
  }

  if (!userId) {
    return createProxyAuthContext();
  }

  const userRecord = await getOrCreateUserRecord({ db, auth, runAppTransaction }, userId);
  const authContext = tryBuildAuthContext(accessLevel, userRecord);
  const roles = {
    requiredRole: AccessLevelToRoleMap[accessLevel],
    yourRoles: getUserCurrentRoles(userRecord),
  };
  if (!authContext) {
    logger.error("Unauthorized request - user does not satisfy auth policy.", {
      tag: "resolveAuthContext",
      accessLevel,
      userId,
      ...roles,
    });
    throw new Forbidden({ data: roles });
  }

  return authContext;
};
