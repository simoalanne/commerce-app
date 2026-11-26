import assert from "node:assert";

import { describe, it } from "vitest";

import { EntityInUse } from "#src/routing/errors.ts";

import tryDeleteEntity from "./tryDeleteEntity.ts";

describe("tryDeleteEntity", () => {
  it("translates expected foreign key errors into EntityInUse", async () => {
    await assert.rejects(
      tryDeleteEntity(async () => {
        throw { name: "DriverAdapterError", cause: { code: "23001" } };
      }),
      (error) => error instanceof EntityInUse,
    );
  });

  it("rethrows unrelated errors unchanged", async () => {
    const originalError = new Error("Unexpected failure");

    await assert.rejects(
      tryDeleteEntity(async () => {
        throw originalError;
      }),
      (error) => error === originalError,
    );
  });
});
