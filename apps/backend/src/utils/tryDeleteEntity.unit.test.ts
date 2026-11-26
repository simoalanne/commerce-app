import { EntityInUse } from "#src/routing/errors.ts";

import tryDeleteEntity from "./tryDeleteEntity.ts";

describe("tryDeleteEntity", () => {
  it("translates expected foreign key errors into EntityInUse", async () => {
    await expect(
      tryDeleteEntity(async () => {
        throw { name: "DriverAdapterError", cause: { code: "23001" } };
      }),
    ).rejects.toBeInstanceOf(EntityInUse);
  });

  it("rethrows unrelated errors unchanged", async () => {
    const originalError = new Error("Unexpected failure");

    await expect(
      tryDeleteEntity(async () => {
        throw originalError;
      }),
    ).rejects.toBe(originalError);
  });
});
