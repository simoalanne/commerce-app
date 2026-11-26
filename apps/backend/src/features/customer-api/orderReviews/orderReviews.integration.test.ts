import { randomUUID } from "node:crypto";

import { RouteError } from "@rest-rpc/server";
import { inArray } from "drizzle-orm";

import envConfig from "#src/config.ts";
import { db } from "#src/db/client.ts";
import {
  categoryTable,
  orderTable,
  orderItemTable,
  productTable,
  reviewTable,
  vendorTable,
} from "#src/db/schema.ts";
import { createOrderCapabilityJwt } from "#src/features/customer-api/orders/orderCapabilities.ts";
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
    await db.delete(reviewTable).where(inArray(reviewTable.id, [...createdReviewIds]));
    createdReviewIds.clear();
  }

  if (createdOrderIds.size > 0) {
    await db.delete(orderTable).where(inArray(orderTable.id, [...createdOrderIds]));
    createdOrderIds.clear();
  }

  if (createdProductSkus.size > 0) {
    await db.delete(productTable).where(inArray(productTable.sku, [...createdProductSkus]));
    createdProductSkus.clear();
  }

  if (createdVendorIds.size > 0) {
    await db.delete(vendorTable).where(inArray(vendorTable.id, [...createdVendorIds]));
    createdVendorIds.clear();
  }

  if (createdCategoryIds.size > 0) {
    await db.delete(categoryTable).where(inArray(categoryTable.id, [...createdCategoryIds]));
    createdCategoryIds.clear();
  }
});

const createOrderReviewScenario = async ({
  status = "SHIPPED",
}: {
  status?: "SHIPPED" | "PAID";
} = {}) => {
  const category = await createCategory();
  createdCategoryIds.add(category.id);

  const vendorOne = await createVendor();
  const vendorTwo = await createVendor();
  createdVendorIds.add(vendorOne.id);
  createdVendorIds.add(vendorTwo.id);

  const productOne = await createProduct({
    vendorId: vendorOne.id,
    categoryIds: [category.id],
  });
  const productTwo = await createProduct({
    vendorId: vendorOne.id,
    categoryIds: [category.id],
  });
  const productThree = await createProduct({
    vendorId: vendorTwo.id,
    categoryIds: [category.id],
  });
  createdProductSkus.add(productOne.sku);
  createdProductSkus.add(productTwo.sku);
  createdProductSkus.add(productThree.sku);

  const claimToken = randomUUID();
  const order = await createOrder(
    {
      status,
      customerId: null,
      claimToken,
      orderDetails: {
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
    },
    status,
  );
  createdOrderIds.add(order.id);
  await db.insert(orderItemTable).values([
    {
      orderId: order.id,
      sku: productOne.sku,
      name: productOne.name.en ?? "",
      quantity: 1,
      unitCostPriceCents: productOne.costPriceCents,
      unitSalesPriceCents: 990,
      productId: productOne.id,
      vendorId: vendorOne.id,
      vendorName: vendorOne.name,
    },
    {
      orderId: order.id,
      sku: productTwo.sku,
      name: productTwo.name.en ?? "",
      quantity: 2,
      unitCostPriceCents: productTwo.costPriceCents,
      unitSalesPriceCents: 550,
      productId: productTwo.id,
      vendorId: vendorOne.id,
      vendorName: vendorOne.name,
    },
    {
      orderId: order.id,
      sku: productThree.sku,
      name: productThree.name.en ?? "",
      quantity: 1,
      unitCostPriceCents: productThree.costPriceCents,
      unitSalesPriceCents: 1250,
      productId: productThree.id,
      vendorId: vendorTwo.id,
      vendorName: vendorTwo.name,
    },
  ]);

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
    { db, config: envConfig },
    { token: claimToken, scope: "order:review" },
  );

  return capability.accessToken;
};

describe("customerApi.orderReviews integration", () => {
  it("returns flat reviewables and existing saved reviews for a shipped order", async () => {
    const scenario = await createOrderReviewScenario();

    const [productReview, storeReview] = await db
      .insert(reviewTable)
      .values([
        {
          kind: "PRODUCT",
          orderId: scenario.order.id,
          productId: scenario.productOne.id,
          reviewerName: "Review Guest",
          showReviewerName: false,
          rating: 5,
          comment: "Great apples",
        },
        {
          kind: "STORE_EXPERIENCE",
          orderId: scenario.order.id,
          reviewerName: "Review Guest",
          showReviewerName: false,
          rating: 4,
          comment: "Smooth delivery",
        },
      ])
      .returning();
    createdReviewIds.add(productReview.id);
    createdReviewIds.add(storeReview.id);

    const token = await createReviewAccessToken(scenario.claimToken);
    const { body: result } = await client.orderReviews.getByOrder({
      query: { token },
    });

    expect(result.reviewables.length).toBe(6);
    expect(result.reviewables[0].kind).toBe("PRODUCT");
    if (result.reviewables[0].kind !== "PRODUCT") {
      throw new Error("Expected first reviewable to be a product");
    }
    expect(result.reviewables[0].productId).toBe(scenario.productOne.id);
    expect(result.reviewables[0].productName).toBe(scenario.productOne.name.en);
    expect(result.reviewables[0].vendorName).toBe(scenario.vendorOne.name);
    expect(result.reviewables[0].productImageUrl).toBeTruthy();
    expect(result.reviewables[0].review).toStrictEqual({
      rating: 5,
      comment: "Great apples",
      showReviewerName: false,
      imageUrl: null,
      objectKey: null,
    });

    const storeReviewable = result.reviewables.find(
      (reviewable) => reviewable.kind === "STORE_EXPERIENCE",
    );
    expect(storeReviewable).toStrictEqual({
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

    const storedReviews = await db.query.review.findMany({
      where: { orderId: scenario.order.id },
      orderBy: { productId: "asc", id: "asc" },
    });

    expect(storedReviews.length).toBe(4);
    expect(storedReviews.every((review) => review.reviewerName === "Review Guest")).toBe(true);
    const storedReviewSummaries = storedReviews
      .map((review) => ({
        kind: review.kind,
        productId: review.productId,
        rating: review.rating,
        comment: review.comment,
        showReviewerName: review.showReviewerName,
      }))
      .sort(
        (left, right) =>
          left.kind.localeCompare(right.kind) || (left.productId ?? 0) - (right.productId ?? 0),
      );
    expect(storedReviewSummaries).toStrictEqual([
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
      {
        kind: "STORE_EXPERIENCE",
        productId: null,
        rating: 4,
        comment: "Easy order",
        showReviewerName: false,
      },
    ]);
  });

  it("rejects non-reviewable targets for the order", async () => {
    const scenario = await createOrderReviewScenario();
    const unrelatedProduct = await createProduct({
      vendorId: scenario.vendorOne.id,
      categoryIds: [...createdCategoryIds].slice(0, 1),
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

    expect(error).toBeInstanceOf(RouteError);
    expect(error).toHaveProperty("status", 400);
  });

  it("does not expose orders that have not shipped as reviewable", async () => {
    const scenario = await createOrderReviewScenario({ status: "PAID" });

    const error = await client.orderReviews
      .getByOrder({
        query: { token: await createReviewAccessToken(scenario.claimToken) },
      })
      .catch((error: unknown) => error);

    expect(error).toBeInstanceOf(RouteError);
    expect(error).toHaveProperty("status", 404);
  });
});
