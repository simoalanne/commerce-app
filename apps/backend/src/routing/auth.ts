import { and, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "#src/db/client.ts";
import { isUniqueViolation } from "#src/db/errors.ts";
import { customerAccountTable, orderTable, userTable } from "#src/db/schema.ts";
import type { AuthProvider } from "#src/integrations/auth/auth.provider.ts";
import logger from "#src/logger.ts";

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
  db: Db;
  auth: AuthProvider;
};

const findUserRecord = (db: Db, userId: string) =>
  db.query.user.findFirst({
    where: { clerkId: userId },
    columns: { clerkId: true },
    with: {
      customerAccount: { columns: { id: true } },
      adminAccount: { columns: { id: true } },
    },
  });

type LocalUserRecord = NonNullable<Awaited<ReturnType<typeof findUserRecord>>>;

const getOrCreateUserRecord = async (
  { db, auth }: Omit<AuthDependencies, "headers">,
  userId: string,
): Promise<LocalUserRecord> => {
  const existingUser = await findUserRecord(db, userId);

  if (existingUser) {
    return existingUser;
  }

  const authUser = await auth.getUserById(userId);

  try {
    const createdUser = await db.transaction(async (tx) => {
      await tx.insert(userTable).values({ clerkId: userId });
      const [customerAccount] = await tx
        .insert(customerAccountTable)
        .values({ userId })
        .returning({ id: customerAccountTable.id });
      const createdUser = {
        clerkId: userId,
        customerAccount,
        adminAccount: null,
      };

      const normalizedEmail = authUser.email?.trim().toLowerCase();
      if (!normalizedEmail) {
        return createdUser;
      }

      await tx
        .update(orderTable)
        .set({ customerId: customerAccount.id, hasBeenLinkedToCustomerAccount: true })
        .where(
          and(
            isNull(orderTable.customerId),
            eq(orderTable.hasBeenLinkedToCustomerAccount, false),
            sql`${orderTable.orderDetails}->'customer'->>'email' = ${normalizedEmail}`,
          ),
        );

      return createdUser;
    });

    logger.info("Created local user from auth identity", {
      tag: "auth-sync",
      userId,
    });

    return createdUser;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const userRecord = await findUserRecord(db, userId);

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
  const customerId = userRecord.customerAccount?.id;

  if (!customerId) {
    throw new Error(
      "Authenticated user is missing customer record in DB, which should have been created automatically",
    );
  }

  const authContext = {
    isAuthenticated: true,
    clerkId: userRecord.clerkId,
    customerId,
    adminId: userRecord.adminAccount?.id ?? null,
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
  if (userRecord.customerAccount) roles.push("Customer");
  if (userRecord.adminAccount) roles.push("Admin");
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
  { headers, db, auth }: AuthDependencies,
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

  const userRecord = await getOrCreateUserRecord({ db, auth }, userId);
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
