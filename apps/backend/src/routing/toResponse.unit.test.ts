import assert from "node:assert/strict";

import { Prisma } from "@prisma/client";
import { describe, it } from "vitest";

import { toResponse } from "./toResponse.ts";

describe("toResponse", () => {
  it("converts decimals and dates, nested in objects and arrays", () => {
    const result = toResponse(
      {
        price: new Prisma.Decimal("19.99"),
        items: [{ at: new Date("2026-01-02T03:04:05.000Z") }],
      },
      "en",
    );

    assert.deepEqual(result, {
      price: 19.99,
      items: [{ at: "2026-01-02T03:04:05.000Z" }],
    });
  });

  it("localizes to the requested locale", () => {
    const result = toResponse({ name: { en: "hello" }, tags: { en: ["b"] } }, "en");

    assert.deepEqual(result, { name: "hello", tags: ["b"] });
  });

  it("localizes records of localized objects, converting the picked value", () => {
    const result = toResponse(
      {
        en: { message: "Hi", at: new Date(0) },
      },
      "en",
    );

    assert.deepEqual(result, { message: "Hi", at: "1970-01-01T00:00:00.000Z" });
  });

  it("returns an empty value of the stored kind without a usable value", () => {
    const result = toResponse({ a: { en: "" }, b: { en: [] } }, "en");

    assert.deepEqual(result, { a: "", b: [] });
  });

  it("leaves objects with other keys alone", () => {
    const uploadHeaders = { "content-type": "image/png" };
    const mixed = { en: "x", other: "y" };

    assert.deepEqual(toResponse({ uploadHeaders, mixed }, "en"), {
      uploadHeaders,
      mixed,
    });
  });

  it("keeps localized objects without a locale", () => {
    const result = toResponse({
      name: { en: "hello" },
      price: new Prisma.Decimal("1"),
    });

    assert.deepEqual(result, { name: { en: "hello" }, price: 1 });
  });

  it("types the result as what JSON delivers", () => {
    const value = {
      price: new Prisma.Decimal("1"),
      at: new Date(),
      name: { en: "x" } as PrismaJson.LocalizedString,
      list: { en: ["x"] } as PrismaJson.LocalizedStringArray,
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
    raw satisfies { name: PrismaJson.LocalizedString; price: number };
  });
});
