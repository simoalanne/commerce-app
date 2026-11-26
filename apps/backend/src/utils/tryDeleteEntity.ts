import { isForeignKeyViolation } from "#src/db/errors.ts";
import { EntityInUse } from "#src/routing/errors.ts";

/** Runs a delete, turning a violated reference into EntityInUse. */
const tryDeleteEntity = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new EntityInUse({ cause: error });
    throw error;
  }
};

export default tryDeleteEntity;
