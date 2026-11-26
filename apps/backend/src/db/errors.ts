// Drizzle wraps driver errors in DrizzleQueryError, with the pg error, which
// has the Postgres error code, as its cause.
const postgresErrorCode = (error: unknown): string | undefined => {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ("code" in current && typeof current.code === "string") return current.code;
  }
  return undefined;
};

export const isUniqueViolation = (error: unknown) => postgresErrorCode(error) === "23505";

// 23503 for NO ACTION references, 23001 for RESTRICT ones.
export const isForeignKeyViolation = (error: unknown) => {
  const code = postgresErrorCode(error);
  return code === "23503" || code === "23001";
};
