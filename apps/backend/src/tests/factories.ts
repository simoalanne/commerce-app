import { slugify } from "@acme/shared";

import { db } from "#src/db/client.ts";
import {
  categoryTable,
  customerAccountTable,
  imageTable,
  orderTable,
  type OrderStatus,
  productImageTable,
  productTable,
  productTagTable,
  reviewTable,
  tagTable,
  userTable,
  vendorImageTable,
  vendorTable,
} from "#src/db/schema.ts";
import { buildLocalizedSlugFromLocalizedText } from "#src/utils/localizedSlug.ts";

const uniqueValue = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const imageStorageKey = (kind: string, slug: string) =>
  `${kind}s/${slug}/${uniqueValue("image")}.jpg`;

const insertImage = async (storageKey: string) =>
  (await db.insert(imageTable).values({ storageKey }).returning())[0];

export const createCategory = async (
  overrides: Partial<typeof categoryTable.$inferInsert> = {},
) => {
  const name = overrides.name ?? { en: "Test category" };
  const slug = overrides.slug ?? buildLocalizedSlugFromLocalizedText(name);
  const imageSlug = typeof slug.en === "string" ? slug.en : uniqueValue("category").toLowerCase();
  const image = await insertImage(imageStorageKey("category", imageSlug));

  const [category] = await db
    .insert(categoryTable)
    .values({ name, slug, imageId: image.id, ...overrides })
    .returning();
  return category;
};

export const createUser = async (overrides: Partial<typeof userTable.$inferInsert> = {}) => {
  const [user] = await db
    .insert(userTable)
    .values({ clerkId: uniqueValue("clerk"), ...overrides })
    .returning();
  return user;
};

export const createCustomerAccount = async ({
  user: providedUser,
  ...overrides
}: Partial<typeof customerAccountTable.$inferInsert> & { user?: { clerkId: string } } = {}) => {
  const user = providedUser ?? (await createUser());

  const [account] = await db
    .insert(customerAccountTable)
    .values({ userId: user.clerkId, ...overrides })
    .returning();
  return account;
};

export const createVendor = async (overrides: Partial<typeof vendorTable.$inferInsert> = {}) => {
  const name = overrides.name ?? uniqueValue("Vendor");
  const slug = overrides.slug ?? slugify(name);

  const [vendor] = await db
    .insert(vendorTable)
    .values({
      name,
      slug,
      slogan: { en: "Test slogan" },
      story: { en: "Test story" },
      tags: { en: ["test"] },
      ...overrides,
    })
    .returning();
  const image = await insertImage(imageStorageKey("vendor", slug));
  await db.insert(vendorImageTable).values({ vendorId: vendor.id, imageId: image.id });
  return vendor;
};

export const createProduct = async ({
  categoryIds,
  ...overrides
}: Partial<typeof productTable.$inferInsert> & { categoryIds?: number[] } = {}) => {
  const vendorId = overrides.vendorId ?? (await createVendor()).id;
  const categoryId =
    categoryIds?.[0] ??
    (overrides.categoryId === undefined ? (await createCategory()).id : overrides.categoryId);
  const name = overrides.name ?? { en: "Test product" };
  const slug = overrides.slug ?? buildLocalizedSlugFromLocalizedText(name);
  const imageSlug = typeof slug.en === "string" ? slug.en : uniqueValue("product");

  const [product] = await db
    .insert(productTable)
    .values({
      sku: uniqueValue("sku"),
      slug,
      name,
      headline: { en: "Test headline" },
      fullDescription: { en: "Test description" },
      costPriceCents: 990,
      salesPriceCents: 990,
      currentStock: 10,
      storefrontVisibility: "ACTIVE",
      ...overrides,
      categoryId,
      vendorId,
    })
    .returning();

  const [tag] = await db
    .insert(tagTable)
    .values({ name: { en: "test" }, color: "#16a34a" })
    .returning();
  await db.insert(productTagTable).values({ productId: product.id, tagId: tag.id });
  const image = await insertImage(imageStorageKey("product", imageSlug));
  await db.insert(productImageTable).values({ productId: product.id, imageId: image.id });
  return product;
};

export const createOrder = async (
  overrides: Partial<typeof orderTable.$inferInsert> = {},
  status: OrderStatus = "PENDING",
) => {
  const customerId =
    overrides.customerId === undefined ? (await createCustomerAccount()).id : overrides.customerId;

  const [order] = await db
    .insert(orderTable)
    .values({
      itemsSubtotalCents: 1990,
      itemsDiscountCents: 0,
      chargedTotalCents: 1990,
      vatRate: 20,
      includedVatCents: 332,
      paymentProvider: "STRIPE",
      status,
      orderDetails: {
        customer: {
          name: "Test Customer",
          email: "customer@example.com",
          phone: "+1555401112222",
        },
        shippingAddress: {
          line1: "Test Street",
          line2: null,
          postalCode: "10001",
          city: "Springfield",
          country: "US",
        },
      },
      // Tests that read invoice details set them.
      invoiceDetails: {} as typeof orderTable.$inferInsert.invoiceDetails,
      ...overrides,
      customerId,
    })
    .returning();

  return order;
};

const createReview = async (
  kind: "VENDOR" | "PRODUCT",
  overrides: Partial<typeof reviewTable.$inferInsert>,
  defaults: { vendorId?: number; productId?: number },
) => {
  const orderId = overrides.orderId === undefined ? (await createOrder()).id : overrides.orderId;

  const [review] = await db
    .insert(reviewTable)
    .values({
      kind,
      reviewerName: "Test Reviewer",
      showReviewerName: true,
      rating: 4,
      comment: "Test review",
      ...defaults,
      ...overrides,
      orderId,
    })
    .returning();
  return review;
};

export const createProductReview = async (
  overrides: Partial<typeof reviewTable.$inferInsert> = {},
) =>
  createReview("PRODUCT", overrides, {
    productId: overrides.productId ?? (await createProduct()).id,
  });
