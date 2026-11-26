import { Prisma } from "@prisma/client";

import { getChangedFields, toSafeJsonValue } from "./adminActionLog.ts";

describe("adminActionLog utils", () => {
  describe("toSafeJsonValue", () => {
    it("keeps serialized primitives as-is", () => {
      expect(toSafeJsonValue("value")).toBe("value");
      expect(toSafeJsonValue(true)).toBe(true);
      expect(toSafeJsonValue(12)).toBe(12);
      expect(toSafeJsonValue(null)).toBe(null);
    });

    it("serializes dates and Prisma decimals", () => {
      const date = new Date("2026-07-12T15:53:38.105Z");

      expect(toSafeJsonValue(date)).toBe("2026-07-12T15:53:38.105Z");
      expect(toSafeJsonValue(new Prisma.Decimal("12.5"))).toBe(12.5);
    });

    it("discards unsupported non-object values", () => {
      expect(toSafeJsonValue(1n)).toBe(undefined);
      expect(toSafeJsonValue(Symbol("value"))).toBe(undefined);
      expect(
        toSafeJsonValue({
          name: "value",
          metadata: 1n,
        }),
      ).toEqual({
        name: "value",
        metadata: undefined,
      });
    });

    it("recursively serializes objects and arrays", () => {
      const date = new Date("2026-07-12T15:53:38.105Z");

      expect(
        toSafeJsonValue({
          name: {
            de: "Gemuese",
          },
          prices: [new Prisma.Decimal("4.5")],
          created_at: date,
        }),
      ).toEqual({
        name: {
          de: "Gemuese",
        },
        prices: [4.5],
        created_at: "2026-07-12T15:53:38.105Z",
      });
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

      expect(diff).toEqual({
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

      expect(diff).toEqual({
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

      expect(diff).toEqual({
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

      expect(diff).toEqual({
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
