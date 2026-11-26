import type { AppContext } from "#src/routing/base.ts";

// A dependency a test did not stub fails loudly on first use instead of
// returning undefined.
const unstubbed = <T extends object>(name: string) =>
  new Proxy({} as T, {
    get: (_, property) => {
      throw new Error(`Test used ${name}.${String(property)} without stubbing it`);
    },
  });

export const createTestContext = (overrides: Partial<AppContext> = {}): AppContext => ({
  headers: new Headers(),
  db: unstubbed("db"),
  config: unstubbed("config"),
  auth: unstubbed("auth"),
  payments: unstubbed("payments"),
  email: unstubbed("email"),
  storage: unstubbed("storage"),
  search: unstubbed("search"),
  jobQueue: unstubbed("jobQueue"),
  runAppTransaction: () => {
    throw new Error("Test used runAppTransaction without stubbing it");
  },
  ...overrides,
});
