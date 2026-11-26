import assert from "node:assert";

import { afterEach, describe, it } from "vitest";

import prismaClient from "#src/prisma.ts";
import { customerRouter } from "#src/routes.ts";
import { createTestClient } from "#src/tests/createTestClient.ts";
import {
  createCategory,
  createVendor,
  createProduct,
  createProductReview,
  createUser,
} from "#src/tests/factories.ts";

const client = createTestClient(customerRouter);

const createdCategoryIds = new Set<number>();
const createdProductIds = new Set<number>();
const createdVendorIds = new Set<number>();
const createdReviewIds = new Set<number>();
const createdUserIds = new Set<string>();

afterEach(async () => {
  if (createdReviewIds.size > 0) {
    await prismaClient.review.deleteMany({
      where: { id: { in: [...createdReviewIds] } },
    });
    createdReviewIds.clear();
  }

  if (createdProductIds.size > 0) {
    await prismaClient.product.deleteMany({
      where: { id: { in: [...createdProductIds] } },
    });
    createdProductIds.clear();
  }

  if (createdVendorIds.size > 0) {
    await prismaClient.vendor.deleteMany({
      where: { id: { in: [...createdVendorIds] } },
    });
    createdVendorIds.clear();
  }

  if (createdCategoryIds.size > 0) {
    await prismaClient.category.deleteMany({
      where: { id: { in: [...createdCategoryIds] } },
    });
    createdCategoryIds.clear();
  }

  if (createdUserIds.size > 0) {
    await prismaClient.user.deleteMany({
      where: { clerk_id: { in: [...createdUserIds] } },
    });
    createdUserIds.clear();
  }
});

describe("customerApi.reviews", () => {
  it("returns only reviews for the requested product with matching summary", async () => {
    const vendor = await createVendor();
    createdVendorIds.add(vendor.id);

    const category = await createCategory();
    createdCategoryIds.add(category.id);

    const requestedProduct = await createProduct({
      vendor_id: vendor.id,
      categoryIds: [category.id],
    });
    const otherProduct = await createProduct({
      vendor_id: vendor.id,
      categoryIds: [category.id],
    });
    createdProductIds.add(requestedProduct.id);
    createdProductIds.add(otherProduct.id);

    const namedReviewer = await createUser();
    const anonymousReviewer = await createUser();
    createdUserIds.add(namedReviewer.clerk_id);
    createdUserIds.add(anonymousReviewer.clerk_id);

    const namedReview = await createProductReview({
      product_id: requestedProduct.id,
      reviewer_name: "Test Reviewer",
      show_reviewer_name: true,
      status: "APPROVED",
      rating: 4,
      comment: "Named review",
    });
    const anonymousReview = await createProductReview({
      product_id: requestedProduct.id,
      reviewer_name: "Anonymous Reviewer",
      show_reviewer_name: false,
      status: "APPROVED",
      rating: 5,
      comment: "Anonymous review",
    });
    const unrelatedReview = await createProductReview({
      product_id: otherProduct.id,
      rating: 1,
      comment: "Should not be returned",
    });
    createdReviewIds.add(namedReview.id);
    createdReviewIds.add(anonymousReview.id);
    createdReviewIds.add(unrelatedReview.id);

    await prismaClient.review.update({
      where: { id: namedReview.id },
      data: { updated_at: new Date("2026-02-01T10:00:00.000Z") },
    });
    await prismaClient.review.update({
      where: { id: anonymousReview.id },
      data: { updated_at: new Date("2026-02-02T10:00:00.000Z") },
    });

    const { body: result } = await client.reviews.getByProduct({
      params: { productId: requestedProduct.id },
    });

    assert.strictEqual(result.summary.avgRating, 4.5);
    assert.strictEqual(result.summary.reviewCount, 2);
    assert.strictEqual(result.items.length, 2);

    assert.strictEqual(result.items[0].comment, "Anonymous review");
    assert.strictEqual(result.items[0].reviewer.isAnonymous, true);
    assert.strictEqual(result.items[0].reviewer.displayName, null);

    assert.strictEqual(result.items[1].comment, "Named review");
    assert.strictEqual(result.items[1].reviewer.isAnonymous, false);
    assert.strictEqual(result.items[1].reviewer.displayName, "Test Reviewer");
    assert.ok(result.items.every((review) => review.productId === requestedProduct.id));
  });
});
