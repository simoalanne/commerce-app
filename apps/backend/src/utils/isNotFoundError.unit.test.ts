import { isNotFoundError } from "./isNotFoundError.ts";
import { NotFoundError } from "./notFoundError.ts";

describe("isNotFoundError", () => {
  it("returns true for NotFoundError", () => {
    expect(isNotFoundError(new NotFoundError("Missing vendor"))).toBe(true);
  });

  it("returns true for Prisma P2025 errors", () => {
    expect(
      isNotFoundError({
        code: "P2025",
        message: "Record to update not found.",
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isNotFoundError(new Error("Unexpected failure"))).toBe(false);
    expect(
      isNotFoundError({
        code: "P2002",
      }),
    ).toBe(false);
  });
});
