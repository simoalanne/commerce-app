import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isNotFoundError } from "./isNotFoundError.ts";
import { NotFoundError } from "./notFoundError.ts";

describe("isNotFoundError", () => {
  it("returns true for NotFoundError", () => {
    assert.equal(isNotFoundError(new NotFoundError("Missing vendor")), true);
  });

  it("returns true for Prisma P2025 errors", () => {
    assert.equal(
      isNotFoundError({
        code: "P2025",
        message: "Record to update not found.",
      }),
      true,
    );
  });

  it("returns false for unrelated errors", () => {
    assert.equal(isNotFoundError(new Error("Unexpected failure")), false);
    assert.equal(
      isNotFoundError({
        code: "P2002",
      }),
      false,
    );
  });
});
