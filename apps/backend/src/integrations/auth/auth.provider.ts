import envConfig from "#src/config.ts";
import logger from "#src/logger.ts";

import { ClerkAuthProvider } from "./auth.provider.clerk.ts";

export type IdentityUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
};

export interface AuthProvider {
  authenticateUser(headers: Headers): Promise<string | null>;
  getUserById(userId: string): Promise<IdentityUser>;
  getUsersByIds(userIds: string[]): Promise<IdentityUser[]>;
  getUserByEmail(email: string): Promise<IdentityUser | null>;
  deleteUser(userId: string): Promise<void>;
  updateUserPassword(userId: string, password: string): Promise<void>;
}

const throwUnconfigured = async (): Promise<never> => {
  throw new Error("Auth provider is not configured");
};

// Without an identity service nobody can sign in, so guest flows work and
// authenticated routes answer 401. Lookups of a specific user can't happen.
const noUsersAuthProvider: AuthProvider = {
  authenticateUser: async () => null,
  getUserById: throwUnconfigured,
  getUsersByIds: async () => [],
  getUserByEmail: async () => null,
  deleteUser: throwUnconfigured,
  updateUserPassword: throwUnconfigured,
};

const canEnableClerk = envConfig.CLERK_SECRET_KEY && envConfig.CLERK_PUBLISHABLE_KEY;

if (!canEnableClerk && envConfig.NODE_ENV === "development") {
  logger.info("Clerk is not configured; sign-in is disabled and only guest flows work");
}

const AuthProvider: AuthProvider =
  envConfig.CLERK_SECRET_KEY && envConfig.CLERK_PUBLISHABLE_KEY
    ? new ClerkAuthProvider(envConfig.CLERK_SECRET_KEY, envConfig.CLERK_PUBLISHABLE_KEY)
    : noUsersAuthProvider;

export default AuthProvider;
