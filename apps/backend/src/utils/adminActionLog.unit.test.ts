import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import { getChangedFields, toSafeJsonValue } from "./adminActionLog.ts";

describe("adminActionLog utils", () => {
  describe("toSafeJsonValue", () => {
    it("keeps serialized primitives as-is", () => {
      assert.equal(toSafeJsonValue("value"), "value");
      assert.equal(toSafeJsonValue(true), true);
      assert.equal(toSafeJsonValue(12), 12);
      assert.equal(toSafeJsonValue(null), null);
    });

    it("serializes dates and Prisma decimals", () => {
      const date = new Date("2026-07-12T15:53:38.105Z");

      assert.equal(toSafeJsonValue(date), "2026-07-12T15:53:38.105Z");
      assert.equal(toSafeJsonValue(new Prisma.Decimal("12.5")), 12.5);
    });

    it("discards unsupported non-object values", () => {
      assert.equal(toSafeJsonValue(1n), undefined);
      assert.equal(toSafeJsonValue(Symbol("value")), undefined);
      assert.deepEqual(
        toSafeJsonValue({
          name: "value",
          metadata: 1n,
        }),
        {
          name: "value",
          metadata: undefined,
        },
      );
    });

    it("recursively serializes objects and arrays", () => {
      const date = new Date("2026-07-12T15:53:38.105Z");

      assert.deepEqual(
        toSafeJsonValue({
          name: {
            de: "Gemuese",
          },
          prices: [new Prisma.Decimal("4.5")],
          created_at: date,
        }),
        {
          name: {
            de: "Gemuese",
          },
          prices: [4.5],
          created_at: "2026-07-12T15:53:38.105Z",
        },
      );
    });
  });

  describe("getChangedFields", () => {
    it("returns only changed nested fields", () => {
      const diff = getChangedFields(
        {
          title: {
            en: "Terms",
            de: "Bedingungen",
          },
          content: {
            en: "English content",
            de: "Old German content",
          },
        },
        {
          title: {
            en: "Terms",
            de: "Bedingungen",
          },
          content: {
            en: "English content",
            de: "New German content",
          },
          updated_at: "2026-07-12T15:53:38.105Z",
        },
      );

      assert.deepEqual(diff, {
        before: {
          content: {
            de: "Old German content",
          },
        },
        after: {
          content: {
            de: "New German content",
          },
        },
      });
    });

    it("logs only appended array items when existing indexes are unchanged", () => {
      const diff = getChangedFields(
        {
          content: {
            de: {
              items: [
                {
                  question: "First",
                  answer: "First answer",
                },
              ],
            },
          },
        },
        {
          content: {
            de: {
              items: [
                {
                  question: "First",
                  answer: "First answer",
                },
                {
                  question: "Second",
                  answer: "Second answer",
                },
              ],
            },
          },
        },
      );

      assert.deepEqual(diff, {
        before: {
          content: {
            de: {
              items: [],
            },
          },
        },
        after: {
          content: {
            de: {
              items: [
                {
                  question: "Second",
                  answer: "Second answer",
                },
              ],
            },
          },
        },
      });
    });

    it("keeps full arrays when items are removed", () => {
      const beforeItems = [
        {
          question: "First",
          answer: "First answer",
        },
        {
          question: "Second",
          answer: "Second answer",
        },
      ];
      const afterItems = [
        {
          question: "First",
          answer: "First answer",
        },
      ];

      const diff = getChangedFields(
        { content: { de: { items: beforeItems } } },
        { content: { de: { items: afterItems } } },
      );

      assert.deepEqual(diff, {
        before: {
          content: {
            de: {
              items: beforeItems,
            },
          },
        },
        after: {
          content: {
            de: {
              items: afterItems,
            },
          },
        },
      });
    });

    it("keeps full arrays when existing items are reordered", () => {
      const first = {
        question: "First",
        answer: "First answer",
      };
      const second = {
        question: "Second",
        answer: "Second answer",
      };

      const diff = getChangedFields(
        { content: { de: { items: [first, second] } } },
        { content: { de: { items: [second, first] } } },
      );

      assert.deepEqual(diff, {
        before: {
          content: {
            de: {
              items: [first, second],
            },
          },
        },
        after: {
          content: {
            de: {
              items: [second, first],
            },
          },
        },
      });
    });
  });
});
