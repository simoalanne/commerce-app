import assert from "node:assert";
import { randomUUID } from "node:crypto";

import { RouteError } from "@rest-rpc/server";
import { afterEach, describe, it } from "vitest";

import envConfig from "#src/config.ts";
import { createOrderCapabilityJwt } from "#src/features/customer-api/orders/orderCapabilities.ts";
import prismaClient from "#src/prisma.ts";
import { customerRouter } from "#src/routes.ts";
import type { AppContext } from "#src/routing/base.ts";
import { createTestClient } from "#src/tests/createTestClient.ts";
import { createCategory, createOrder, createVendor, createProduct } from "#src/tests/factories.ts";

// Only the part of storage these routes use; the cast is the stub boundary.
const storage = {
  getPublicUrl: (objectKey: string) => `https://images.example.com/${objectKey}`,
} as AppContext["storage"];

const client = createTestClient(customerRouter, { storage });

const createdCategoryIds = new Set<number>();
const createdOrderIds = new Set<number>();
const createdVendorIds = new Set<number>();
const createdProductSkus = new Set<string>();
const createdReviewIds = new Set<number>();

afterEach(async () => {
  if (createdReviewIds.size > 0) {
    await prismaClient.review.deleteMany({
      where: { id: { in: [...createdReviewIds] } },
    });
    createdReviewIds.clear();
  }

  if (createdOrderIds.size > 0) {
    await prismaClient.order.deleteMany({
      where: { id: { in: [...createdOrderIds] } },
    });
    createdOrderIds.clear();
  }

  if (createdProductSkus.size > 0) {
    await prismaClient.product.deleteMany({
      where: { sku: { in: [...createdProductSkus] } },
    });
    createdProductSkus.clear();
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
});

const createOrderReviewScenario = async ({
  status = "DELIVERED",
}: {
  status?: "DELIVERED" | "PAID";
} = {}) => {
  const category = await createCategory();
  createdCategoryIds.add(category.id);

  const vendorOne = await createVendor();
  const vendorTwo = await createVendor();
  createdVendorIds.add(vendorOne.id);
  createdVendorIds.add(vendorTwo.id);

  const productOne = await createProduct({
    vendor_id: vendorOne.id,
    categoryIds: [category.id],
  });
  const productTwo = await createProduct({
    vendor_id: vendorOne.id,
    categoryIds: [category.id],
  });
  const productThree = await createProduct({
    vendor_id: vendorTwo.id,
    categoryIds: [category.id],
  });
  createdProductSkus.add(productOne.sku);
  createdProductSkus.add(productTwo.sku);
  createdProductSkus.add(productThree.sku);

  const claimToken = randomUUID();
  const order = await createOrder(
    {
      status,
      customer_id: null,
      claim_token: claimToken,
      order_details: {
        items: [
          { sku: productOne.sku, quantity: 1, unitPrice: 9.9 },
          { sku: productTwo.sku, quantity: 2, unitPrice: 5.5 },
          { sku: productThree.sku, quantity: 1, unitPrice: 12.5 },
        ],
        customer: {
          name: "Review Guest",
          email: "review@example.com",
          phone: "+1555401234571",
        },
        delivery: {
          addressLabel: "7 Review Street, 10001 Springfield",
          city: "Springfield",
          instructions: {},
        },
      },
      order_items: {
        create: [
          {
            sku: productOne.sku,
            name: productOne.name.en,
            quantity: 1,
            unit_cost_price: productOne.cost_price,
            unit_sales_price: 9.9,
            product_id: productOne.id,
            vendor_id: vendorOne.id,
            vendor_name: vendorOne.name,
          },
          {
            sku: productTwo.sku,
            name: productTwo.name.en,
            quantity: 2,
            unit_cost_price: productTwo.cost_price,
            unit_sales_price: 5.5,
            product_id: productTwo.id,
            vendor_id: vendorOne.id,
            vendor_name: vendorOne.name,
          },
          {
            sku: productThree.sku,
            name: productThree.name.en,
            quantity: 1,
            unit_cost_price: productThree.cost_price,
            unit_sales_price: 12.5,
            product_id: productThree.id,
            vendor_id: vendorTwo.id,
            vendor_name: vendorTwo.name,
          },
        ],
      },
    },
    status,
  );
  createdOrderIds.add(order.id);

  return {
    order,
    claimToken,
    vendorOne,
    vendorTwo,
    productOne,
    productTwo,
    productThree,
  };
};

const createReviewAccessToken = async (claimToken: string) => {
  const capability = await createOrderCapabilityJwt(
    { db: prismaClient, config: envConfig },
    { token: claimToken, scope: "order:review" },
  );

  return capability.accessToken;
};

describe("customerApi.orderReviews integration", () => {
  it("returns flat reviewables and existing saved reviews for a delivered order", async () => {
    const scenario = await createOrderReviewScenario();

    const productReview = await prismaClient.review.create({
      data: {
        kind: "PRODUCT",
        order: {
          connect: {
            id: scenario.order.id,
          },
        },
        product: {
          connect: {
            id: scenario.productOne.id,
          },
        },
        reviewer_name: "Review Guest",
        show_reviewer_name: false,
        rating: 5,
        comment: "Great apples",
      },
    });
    const storeReview = await prismaClient.review.create({
      data: {
        kind: "STORE_EXPERIENCE",
        order: {
          connect: {
            id: scenario.order.id,
          },
        },
        reviewer_name: "Review Guest",
        show_reviewer_name: false,
        rating: 4,
        comment: "Smooth delivery",
      },
    });
    createdReviewIds.add(productReview.id);
    createdReviewIds.add(storeReview.id);

    const token = await createReviewAccessToken(scenario.claimToken);
    const { body: result } = await client.orderReviews.getByOrder({
      query: { token },
    });

    assert.strictEqual(result.reviewables.length, 6);
    assert.strictEqual(result.reviewables[0].kind, "PRODUCT");
    if (result.reviewables[0].kind !== "PRODUCT") {
      throw new Error("Expected first reviewable to be a product");
    }
    assert.strictEqual(result.reviewables[0].productId, scenario.productOne.id);
    assert.strictEqual(result.reviewables[0].productName, scenario.productOne.name.en);
    assert.strictEqual(result.reviewables[0].vendorName, scenario.vendorOne.name);
    assert.ok(result.reviewables[0].productImageUrl);
    assert.deepStrictEqual(result.reviewables[0].review, {
      rating: 5,
      comment: "Great apples",
      showReviewerName: false,
      imageUrl: null,
      objectKey: null,
    });

    const storeReviewable = result.reviewables.find(
      (reviewable) => reviewable.kind === "STORE_EXPERIENCE",
    );
    assert.deepStrictEqual(storeReviewable, {
      kind: "STORE_EXPERIENCE",
      review: {
        rating: 4,
        comment: "Smooth delivery",
        showReviewerName: false,
        imageUrl: null,
        objectKey: null,
      },
    });
  });

  it("saves only touched reviews for the order", async () => {
    const scenario = await createOrderReviewScenario();

    const token = await createReviewAccessToken(scenario.claimToken);
    await client.orderReviews.saveByOrder({
      query: { token },
      body: {
        reviews: [
          {
            kind: "PRODUCT",
            productId: scenario.productOne.id,
            review: {
              rating: 4,
              comment: "Fresh",
              showReviewerName: false,
              objectKey: null,
            },
          },
          {
            kind: "PRODUCT",
            productId: scenario.productThree.id,
            review: {
              rating: 3,
              comment: null,
              showReviewerName: false,
              objectKey: null,
            },
          },
          {
            kind: "STORE_EXPERIENCE",
            review: {
              rating: 4,
              comment: "Easy order",
              showReviewerName: false,
              objectKey: null,
            },
          },
        ],
      },
    });

    await client.orderReviews.saveByOrder({
      query: { token },
      body: {
        reviews: [
          {
            kind: "PRODUCT",
            productId: scenario.productTwo.id,
            review: {
              rating: 5,
              comment: "Best item",
              showReviewerName: false,
              objectKey: null,
            },
          },
        ],
      },
    });

    const storedReviews = await prismaClient.review.findMany({
      where: { order_id: scenario.order.id },
      orderBy: [{ product_id: "asc" }, { id: "asc" }],
    });

    assert.strictEqual(storedReviews.length, 4);
    assert.ok(storedReviews.every((review) => review.reviewer_name === "Review Guest"));
    const storedReviewSummaries = storedReviews
      .map((review) => ({
        kind: review.kind,
        productId: review.product_id,
        rating: review.rating,
        comment: review.comment,
        showReviewerName: review.show_reviewer_name,
      }))
      .sort(
        (left, right) =>
          left.kind.localeCompare(right.kind) || (left.productId ?? 0) - (right.productId ?? 0),
      );
    assert.deepStrictEqual(storedReviewSummaries, [
      {
        kind: "STORE_EXPERIENCE",
        productId: null,
        rating: 4,
        comment: "Easy order",
        showReviewerName: false,
      },
      {
        kind: "PRODUCT",
        productId: scenario.productOne.id,
        rating: 4,
        comment: "Fresh",
        showReviewerName: false,
      },
      {
        kind: "PRODUCT",
        productId: scenario.productTwo.id,
        rating: 5,
        comment: "Best item",
        showReviewerName: false,
      },
      {
        kind: "PRODUCT",
        productId: scenario.productThree.id,
        rating: 3,
        comment: null,
        showReviewerName: false,
      },
    ]);
  });

  it("rejects non-reviewable targets for the order", async () => {
    const scenario = await createOrderReviewScenario();
    const unrelatedProduct = await createProduct({
      vendor_id: scenario.vendorOne.id,
      categoryIds: [createdCategoryIds.values().next().value],
    });
    createdProductSkus.add(unrelatedProduct.sku);

    const error = await client.orderReviews
      .saveByOrder({
        query: { token: await createReviewAccessToken(scenario.claimToken) },
        body: {
          reviews: [
            {
              kind: "PRODUCT",
              productId: unrelatedProduct.id,
              review: {
                rating: 4,
                comment: null,
                showReviewerName: false,
                objectKey: null,
              },
            },
          ],
        },
      })
      .catch((error: unknown) => error);

    assert.ok(error instanceof RouteError);
    assert.strictEqual(error.status, 400);
  });

  it("does not expose non-delivered orders as reviewable", async () => {
    const scenario = await createOrderReviewScenario({ status: "PAID" });

    const error = await client.orderReviews
      .getByOrder({
        query: { token: await createReviewAccessToken(scenario.claimToken) },
      })
      .catch((error: unknown) => error);

    assert.ok(error instanceof RouteError);
    assert.strictEqual(error.status, 404);
  });
});
