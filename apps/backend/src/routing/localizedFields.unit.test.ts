import type { LocalizedString, LocalizedStringArray } from "#src/db/json.ts";

import { resolveLocalizedFields } from "./localizedFields.ts";

describe("resolveLocalizedFields", () => {
  it("localizes to the requested locale", () => {
    const result = resolveLocalizedFields({ name: { en: "hello" }, tags: { en: ["b"] } }, "en");

    expect(result).toEqual({ name: "hello", tags: ["b"] });
  });

  it("localizes records of localized objects, converting the picked value", () => {
    const result = resolveLocalizedFields(
      {
        en: { message: "Hi", at: "1970-01-01T00:00:00.000Z" },
      },
      "en",
    );

    expect(result).toEqual({ message: "Hi", at: "1970-01-01T00:00:00.000Z" });
  });

  it("returns an empty value of the stored kind without a usable value", () => {
    const result = resolveLocalizedFields({ a: { en: "" }, b: { en: [] } }, "en");

    expect(result).toEqual({ a: "", b: [] });
  });

  it("leaves objects with other keys alone", () => {
    const uploadHeaders = { "content-type": "image/png" };
    const mixed = { en: "x", other: "y" };

    expect(resolveLocalizedFields({ uploadHeaders, mixed, name: { en: "n" } }, "en")).toEqual({
      uploadHeaders,
      mixed,
      name: "n",
    });
  });

  it("types the result as localized", () => {
    const value = {
      price: 1,
      name: { en: "x" } as LocalizedString,
      list: { en: ["x"] } as LocalizedStringArray,
      headers: {} as Record<string, string>,
    };

    resolveLocalizedFields(value, "en") satisfies {
      price: number;
      name: string;
      list: string[];
      headers: Record<string, string>;
    };
    // @ts-expect-error A value without localized fields needs no resolving.
    resolveLocalizedFields({ price: 1 }, "en");
  });
});
