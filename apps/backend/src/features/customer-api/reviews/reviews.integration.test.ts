import { eq, inArray } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import {
  categoryTable,
  productTable,
  reviewTable,
  userTable,
  vendorTable,
} from "#src/db/schema.ts";
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
    await db.delete(reviewTable).where(inArray(reviewTable.id, [...createdReviewIds]));
    createdReviewIds.clear();
  }

  if (createdProductIds.size > 0) {
    await db.delete(productTable).where(inArray(productTable.id, [...createdProductIds]));
    createdProductIds.clear();
  }

  if (createdVendorIds.size > 0) {
    await db.delete(vendorTable).where(inArray(vendorTable.id, [...createdVendorIds]));
    createdVendorIds.clear();
  }

  if (createdCategoryIds.size > 0) {
    await db.delete(categoryTable).where(inArray(categoryTable.id, [...createdCategoryIds]));
    createdCategoryIds.clear();
  }

  if (createdUserIds.size > 0) {
    await db.delete(userTable).where(inArray(userTable.clerkId, [...createdUserIds]));
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
      vendorId: vendor.id,
      categoryIds: [category.id],
    });
    const otherProduct = await createProduct({
      vendorId: vendor.id,
      categoryIds: [category.id],
    });
    createdProductIds.add(requestedProduct.id);
    createdProductIds.add(otherProduct.id);

    const namedReviewer = await createUser();
    const anonymousReviewer = await createUser();
    createdUserIds.add(namedReviewer.clerkId);
    createdUserIds.add(anonymousReviewer.clerkId);

    const namedReview = await createProductReview({
      productId: requestedProduct.id,
      reviewerName: "Test Reviewer",
      showReviewerName: true,
      status: "APPROVED",
      rating: 4,
      comment: "Named review",
    });
    const anonymousReview = await createProductReview({
      productId: requestedProduct.id,
      reviewerName: "Anonymous Reviewer",
      showReviewerName: false,
      status: "APPROVED",
      rating: 5,
      comment: "Anonymous review",
    });
    const unrelatedReview = await createProductReview({
      productId: otherProduct.id,
      rating: 1,
      comment: "Should not be returned",
    });
    createdReviewIds.add(namedReview.id);
    createdReviewIds.add(anonymousReview.id);
    createdReviewIds.add(unrelatedReview.id);

    await db
      .update(reviewTable)
      .set({ updatedAt: "2026-02-01T10:00:00.000Z" })
      .where(eq(reviewTable.id, namedReview.id));
    await db
      .update(reviewTable)
      .set({ updatedAt: "2026-02-02T10:00:00.000Z" })
      .where(eq(reviewTable.id, anonymousReview.id));

    const { body: result } = await client.reviews.getByProduct({
      params: { productId: requestedProduct.id },
    });

    expect(result.summary.avgRating).toBe(4.5);
    expect(result.summary.reviewCount).toBe(2);
    expect(result.items.length).toBe(2);

    expect(result.items[0].comment).toBe("Anonymous review");
    expect(result.items[0].reviewer.isAnonymous).toBe(true);
    expect(result.items[0].reviewer.displayName).toBe(null);

    expect(result.items[1].comment).toBe("Named review");
    expect(result.items[1].reviewer.isAnonymous).toBe(false);
    expect(result.items[1].reviewer.displayName).toBe("Test Reviewer");
    expect(result.items.every((review) => review.productId === requestedProduct.id)).toBe(true);
  });
});
