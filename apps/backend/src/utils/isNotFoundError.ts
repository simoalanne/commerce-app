import { NotFoundError } from "./notFoundError.ts";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isNotFoundError = (error: unknown) => {
  if (error instanceof NotFoundError) {
    return true;
  }

  if (!isObject(error)) {
    return false;
  }

  return error.code === "P2025";
};
