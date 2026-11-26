import type { LocalizedString, LocalizedStringArray } from "#src/db/json.ts";

import { toResponse } from "./toResponse.ts";

describe("toResponse", () => {
  it("converts dates, nested in objects and arrays", () => {
    const result = toResponse(
      {
        price: 19.99,
        items: [{ at: new Date("2026-01-02T03:04:05.000Z") }],
      },
      "en",
    );

    expect(result).toEqual({
      price: 19.99,
      items: [{ at: "2026-01-02T03:04:05.000Z" }],
    });
  });

  it("localizes to the requested locale", () => {
    const result = toResponse({ name: { en: "hello" }, tags: { en: ["b"] } }, "en");

    expect(result).toEqual({ name: "hello", tags: ["b"] });
  });

  it("localizes records of localized objects, converting the picked value", () => {
    const result = toResponse(
      {
        en: { message: "Hi", at: new Date(0) },
      },
      "en",
    );

    expect(result).toEqual({ message: "Hi", at: "1970-01-01T00:00:00.000Z" });
  });

  it("returns an empty value of the stored kind without a usable value", () => {
    const result = toResponse({ a: { en: "" }, b: { en: [] } }, "en");

    expect(result).toEqual({ a: "", b: [] });
  });

  it("leaves objects with other keys alone", () => {
    const uploadHeaders = { "content-type": "image/png" };
    const mixed = { en: "x", other: "y" };

    expect(toResponse({ uploadHeaders, mixed }, "en")).toEqual({
      uploadHeaders,
      mixed,
    });
  });

  it("keeps localized objects without a locale", () => {
    const result = toResponse({
      name: { en: "hello" },
      price: 1,
    });

    expect(result).toEqual({ name: { en: "hello" }, price: 1 });
  });

  it("types the result as what JSON delivers", () => {
    const value = {
      price: 1,
      at: new Date(),
      name: { en: "x" } as LocalizedString,
      list: { en: ["x"] } as LocalizedStringArray,
      headers: {} as Record<string, string>,
    };
    const localized = toResponse(value, "en");
    const raw = toResponse(value);

    localized satisfies {
      price: number;
      at: string;
      name: string;
      list: string[];
      headers: Record<string, string>;
    };
    raw satisfies { name: LocalizedString; price: number };
  });
});
