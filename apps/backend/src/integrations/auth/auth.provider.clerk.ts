import { createClerkClient, type User, verifyToken } from "@clerk/backend";

import type { AuthProvider, IdentityUser } from "./auth.provider.ts";

const getBearerToken = (headers: Headers) => {
  const authorizationHeader = headers.get("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
};

const normalizeIdentityUser = (user: User): IdentityUser => {
  const email = user.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error(
      "Impossible state: Clerk should be configured to require exactly one email address",
    );
  }

  return {
    id: user.id,
    email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName ?? email,
  };
};

export class ClerkAuthProvider implements AuthProvider {
  private readonly clerkClient: ReturnType<typeof createClerkClient>;
  private readonly secretKey: string;

  constructor(secretKey: string, publishableKey: string) {
    this.secretKey = secretKey;
    this.clerkClient = createClerkClient({
      secretKey,
      publishableKey,
    });
  }

  async authenticateUser(headers: Headers): Promise<string | null> {
    const token = getBearerToken(headers);
    if (!token) {
      return null;
    }

    try {
      const verifiedToken = await verifyToken(token, {
        secretKey: this.secretKey,
      });

      return typeof verifiedToken.sub === "string" ? verifiedToken.sub : null;
    } catch {
      return null;
    }
  }

  async getUserById(userId: string): Promise<IdentityUser> {
    return normalizeIdentityUser(await this.clerkClient.users.getUser(userId));
  }

  async getUsersByIds(userIds: string[]): Promise<IdentityUser[]> {
    if (userIds.length === 0) {
      return [];
    }

    const response = await this.clerkClient.users.getUserList({
      userId: userIds,
      limit: userIds.length,
    });

    return response.data.map(normalizeIdentityUser);
  }

  async getUserByEmail(email: string): Promise<IdentityUser | null> {
    const response = await this.clerkClient.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    const user = response.data[0];

    return user ? normalizeIdentityUser(user) : null;
  }

  async deleteUser(userId: string) {
    await this.clerkClient.users.deleteUser(userId);
  }

  async updateUserPassword(userId: string, password: string) {
    await this.clerkClient.users.updateUser(userId, { password });
  }
}
