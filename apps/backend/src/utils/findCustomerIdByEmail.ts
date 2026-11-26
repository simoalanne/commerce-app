import type { Db } from "#src/db/client.ts";
import type { AuthProvider } from "#src/integrations/auth/auth.provider.ts";

export const findCustomerIdByEmail = async (
  { db, auth }: { db: Db; auth: AuthProvider },
  email: string,
) => {
  const normalizedEmail = email.trim().toLowerCase();

  const authUser = await auth.getUserByEmail(normalizedEmail);

  if (!authUser) return null;

  const account = await db.query.customerAccount.findFirst({
    where: { userId: authUser.id },
    columns: { id: true },
  });

  return account?.id ?? null;
};
