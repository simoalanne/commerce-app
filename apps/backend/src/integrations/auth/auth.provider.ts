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

const stubAuthProvider: AuthProvider = {
  authenticateUser: throwUnconfigured,
  getUserById: throwUnconfigured,
  getUsersByIds: throwUnconfigured,
  getUserByEmail: throwUnconfigured,
  deleteUser: throwUnconfigured,
  updateUserPassword: throwUnconfigured,
};

const canEnableClerk = envConfig.CLERK_SECRET_KEY && envConfig.CLERK_PUBLISHABLE_KEY;

if (!canEnableClerk && envConfig.NODE_ENV === "development") {
  logger.warn("Auth provider will be disabled and auth related features will not work");
}

const AuthProvider: AuthProvider =
  envConfig.CLERK_SECRET_KEY && envConfig.CLERK_PUBLISHABLE_KEY
    ? new ClerkAuthProvider(envConfig.CLERK_SECRET_KEY, envConfig.CLERK_PUBLISHABLE_KEY)
    : stubAuthProvider;

export default AuthProvider;
