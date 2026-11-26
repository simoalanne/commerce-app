import assert from "node:assert";

import { call, RouteError } from "@rest-rpc/server";
import { describe, it } from "vitest";

import { customerRouter } from "#src/routes.ts";
import { createTestContext } from "#src/tests/createTestContext.ts";

// Request validation runs before the handler, so these need no database.
describe("orderReviews.saveByOrder request validation", () => {
  const review = {
    rating: 5,
    comment: null,
    showReviewerName: false,
    objectKey: null,
  };
  const save = (reviews: unknown) =>
    call(
      customerRouter.orderReviews.saveByOrder,
      { query: { token: "token" }, body: { reviews: reviews as never } },
      { context: createTestContext() },
    );

  it("rejects duplicate product reviews", async () => {
    await assert.rejects(
      save([
        { kind: "PRODUCT", productId: 1, review },
        { kind: "PRODUCT", productId: 1, review },
      ]),
      (error) => error instanceof RouteError && error.code === "REQUEST_VALIDATION_FAILED",
    );
  });

  it("rejects an image without a comment", async () => {
    await assert.rejects(
      save([
        {
          kind: "STORE_EXPERIENCE",
          review: { ...review, objectKey: "image.jpg" },
        },
      ]),
      (error) => error instanceof RouteError && error.code === "REQUEST_VALIDATION_FAILED",
    );
  });
});
