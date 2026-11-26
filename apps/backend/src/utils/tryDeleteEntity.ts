import { EntityInUse } from "#src/routing/errors.ts";

export const throwEntityInUseIfForeignKeyConstraint = (error: any) => {
  // NOTE: the error type depends on which db adapter is being used. this
  // backend uses "@prisma/adapter-pg" which means prisma DOES NOT normalize
  // errors thrown by the adapter so this code should check what the regular
  // postgres adapter throws in case of foreign key constraint violation, which is an error with name "DriverAdapterError" and code "23001"
  if (error.name === "DriverAdapterError" && error.cause.code === "23001") {
    throw new EntityInUse({ cause: error });
  }
  throw error;
};

const tryDeleteEntity = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    return throwEntityInUseIfForeignKeyConstraint(error);
  }
};

export default tryDeleteEntity;
