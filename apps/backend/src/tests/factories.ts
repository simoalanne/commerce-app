import { slugify } from "@acme/shared";

import { db } from "#src/db/client.ts";
import {
  categoryTable,
  customerAccountTable,
  imageTable,
  orderItemTable,
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
  (await db.insert(imageTable).values({ storage_key: storageKey }).returning())[0];

export const createCategory = async (
  overrides: Partial<typeof categoryTable.$inferInsert> = {},
) => {
  const name = overrides.name ?? { en: "Test category" };
  const slug = overrides.slug ?? buildLocalizedSlugFromLocalizedText(name);
  const imageSlug = typeof slug.en === "string" ? slug.en : uniqueValue("category").toLowerCase();
  const image = await insertImage(imageStorageKey("category", imageSlug));

  const [category] = await db
    .insert(categoryTable)
    .values({ name, slug, image_id: image.id, ...overrides })
    .returning();
  return category;
};

export const createImage = async (overrides: Partial<typeof imageTable.$inferInsert> = {}) => {
  const slug = uniqueValue("image");

  const [image] = await db
    .insert(imageTable)
    .values({
      name: "Test image",
      alt: {},
      storage_key: imageStorageKey("asset", slug),
      ...overrides,
    })
    .returning();
  return image;
};

export const createUser = async (overrides: Partial<typeof userTable.$inferInsert> = {}) => {
  const [user] = await db
    .insert(userTable)
    .values({ clerk_id: uniqueValue("clerk"), ...overrides })
    .returning();
  return user;
};

export const createCustomerAccount = async ({
  user: providedUser,
  ...overrides
}: Partial<typeof customerAccountTable.$inferInsert> & { user?: { clerk_id: string } } = {}) => {
  const user = providedUser ?? (await createUser());

  const [account] = await db
    .insert(customerAccountTable)
    .values({ user_id: user.clerk_id, ...overrides })
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
  await db.insert(vendorImageTable).values({ vendor_id: vendor.id, image_id: image.id });
  return vendor;
};

export const createProduct = async ({
  categoryIds,
  ...overrides
}: Partial<typeof productTable.$inferInsert> & { categoryIds?: number[] } = {}) => {
  const vendorId = overrides.vendor_id ?? (await createVendor()).id;
  const categoryId =
    categoryIds?.[0] ??
    (overrides.category_id === undefined ? (await createCategory()).id : overrides.category_id);
  const name = overrides.name ?? { en: "Test product" };
  const slug = overrides.slug ?? buildLocalizedSlugFromLocalizedText(name);
  const imageSlug = typeof slug.en === "string" ? slug.en : uniqueValue("product");

  const [product] = await db
    .insert(productTable)
    .values({
      sku: uniqueValue("sku"),
      slug,
      name,
      weight_grams: 500,
      headline: { en: "Test headline" },
      full_description: { en: "Test description" },
      cost_price_cents: 990,
      sales_price_cents: 990,
      current_stock: 10,
      storefront_visibility: "ACTIVE",
      ...overrides,
      category_id: categoryId,
      vendor_id: vendorId,
    })
    .returning();

  const [tag] = await db
    .insert(tagTable)
    .values({ name: { en: "test" }, color: "#16a34a" })
    .returning();
  await db.insert(productTagTable).values({ product_id: product.id, tag_id: tag.id });
  const image = await insertImage(imageStorageKey("product", imageSlug));
  await db.insert(productImageTable).values({ product_id: product.id, image_id: image.id });
  return product;
};

type OrderItemInput = Omit<typeof orderItemTable.$inferInsert, "order_id">;

export const createOrder = async (
  {
    order_items: orderItems = [],
    ...overrides
  }: Partial<typeof orderTable.$inferInsert> & { order_items?: OrderItemInput[] } = {},
  status: OrderStatus = "PENDING",
) => {
  const customerId =
    overrides.customer_id === undefined
      ? (await createCustomerAccount()).id
      : overrides.customer_id;

  const [order] = await db
    .insert(orderTable)
    .values({
      items_subtotal_cents: 1990,
      items_discount_cents: 0,
      charged_total_cents: 1990,
      vat_rate: 20,
      included_vat_cents: 332,
      total_weight_grams: 500,
      payment_provider: "STRIPE",
      status,
      order_details: {
        customer: {
          name: "Test Customer",
          email: "customer@example.com",
          phone: "+1555401112222",
        },
        delivery: {
          addressLabel: "Test Street, 10001 Springfield",
          city: "Springfield",
          instructions: {},
        },
      },
      // Tests that read invoice details set them.
      invoice_details: {} as typeof orderTable.$inferInsert.invoice_details,
      ...overrides,
      customer_id: customerId,
    })
    .returning();

  if (orderItems.length > 0) {
    await db
      .insert(orderItemTable)
      .values(orderItems.map((item) => ({ ...item, order_id: order.id })));
  }
  return order;
};

const createReview = async (
  kind: "VENDOR" | "PRODUCT",
  overrides: Partial<typeof reviewTable.$inferInsert>,
  defaults: { vendor_id?: number; product_id?: number },
) => {
  const orderId = overrides.order_id === undefined ? (await createOrder()).id : overrides.order_id;

  const [review] = await db
    .insert(reviewTable)
    .values({
      kind,
      reviewer_name: "Test Reviewer",
      show_reviewer_name: true,
      rating: 4,
      comment: "Test review",
      ...defaults,
      ...overrides,
      order_id: orderId,
    })
    .returning();
  return review;
};

export const createVendorReview = async (
  overrides: Partial<typeof reviewTable.$inferInsert> = {},
) =>
  createReview("VENDOR", overrides, {
    vendor_id: overrides.vendor_id ?? (await createVendor()).id,
  });

export const createProductReview = async (
  overrides: Partial<typeof reviewTable.$inferInsert> = {},
) =>
  createReview("PRODUCT", overrides, {
    product_id: overrides.product_id ?? (await createProduct()).id,
  });
