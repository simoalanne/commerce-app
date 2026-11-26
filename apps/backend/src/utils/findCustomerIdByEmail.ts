import type { PrismaClient } from "@prisma/client";

import type { AuthProvider } from "#src/integrations/auth/auth.provider.ts";

export const findCustomerIdByEmail = async (
  { db, auth }: { db: PrismaClient; auth: AuthProvider },
  email: string,
) => {
  const normalizedEmail = email.trim().toLowerCase();

  const authUser = await auth.getUserByEmail(normalizedEmail);

  if (!authUser) return null;

  const account = await db.customerAccount.findUnique({
    where: { user_id: authUser.id },
    select: { id: true },
  });

  return account?.id ?? null;
};
