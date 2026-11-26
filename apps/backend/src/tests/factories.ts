import { slugify } from "@acme/shared";
import type { OrderStatus } from "@prisma/client";

import prismaClient from "#src/prisma.ts";
import { buildLocalizedSlugFromLocalizedText } from "#src/utils/localizedSlug.ts";

const uniqueValue = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/*const imageUrl = (kind: string, slug: string) =>
	`https://images.example.com/${kind}s/${slug}/${uniqueValue("image")}.jpg`;*/

const imageStorageKey = (kind: string, slug: string) =>
  `${kind}s/${slug}/${uniqueValue("image")}.jpg`;

const buildImageLinkCreate = (kind: string, slug: string) => {
  const storageKey = imageStorageKey(kind, slug);

  return {
    create: [
      {
        image: {
          create: {
            storage_key: storageKey,
          },
        },
      },
    ],
  };
};

export const createCategory = async (overrides: any = {}) => {
  const name = overrides.name ?? {
    en: "Test category",
  };
  const slug = overrides.slug ?? buildLocalizedSlugFromLocalizedText(name);
  const imageSlug = typeof slug.en === "string" ? slug.en : uniqueValue("category").toLowerCase();

  return prismaClient.category.create({
    data: {
      name,
      slug,
      image: {
        create: {
          storage_key: imageStorageKey("category", imageSlug),
        },
      },
      ...overrides,
    },
  });
};

export const createImage = async (overrides: any = {}) => {
  const slug = uniqueValue("image");

  return prismaClient.image.create({
    data: {
      name: overrides.name ?? "Test image",
      alt: overrides.alt ?? {},
      storage_key: overrides.storage_key ?? imageStorageKey("asset", slug),
      ...overrides,
    },
  });
};

export const createUser = async (overrides: any = {}) => {
  return prismaClient.user.create({
    data: {
      clerk_id: uniqueValue("clerk"),
      ...overrides,
    },
  });
};

export const createCustomerAccount = async (overrides: any = {}) => {
  const { user: providedUser, ...dataOverrides } = overrides;
  const user = providedUser ?? (await createUser());

  return prismaClient.customerAccount.create({
    data: {
      user_id: user.clerk_id,
      ...dataOverrides,
    },
  });
};

export const createAddress = async (overrides: any = {}) => {
  const {
    customer,
    customer_id,
    delivery_instructions: deliveryInstructionsOverride,
    address_type: addressTypeOverride,
    entrance: entranceOverride,
    floor: floorOverride,
    apartment: apartmentOverride,
    delivery_details,
    ...restOverrides
  } = overrides;
  const hasCustomerReference = customer != null || customer_id != null;
  const customerAccount = hasCustomerReference ? null : await createCustomerAccount();
  const resolvedCustomerId = customer?.id ?? customer_id ?? customerAccount?.id;

  return prismaClient.customerAddress.create({
    data: {
      customer: { connect: { id: resolvedCustomerId } },
      street: "Test Street",
      street_number: null,
      postal_code: "10001",
      city: "Springfield",
      delivery_details: delivery_details ?? {
        addressType: addressTypeOverride ?? null,
        entrance: entranceOverride ?? null,
        floor: floorOverride ?? null,
        apartment: apartmentOverride ?? null,
        deliveryInstructions: deliveryInstructionsOverride ?? {},
      },
      ...restOverrides,
    },
  });
};

export const createVendor = async (overrides: any = {}) => {
  const dataOverrides = overrides;
  const name = dataOverrides.name ?? uniqueValue("Vendor");
  const slug = dataOverrides.slug ?? slugify(name);
  const imageSlug = slug;

  return prismaClient.vendor.create({
    data: {
      name,
      slug,
      slogan: { en: "Test slogan" },
      story: { en: "Test story" },
      images: buildImageLinkCreate("vendor", imageSlug),
      tags: {
        en: ["test"],
      },
      ...dataOverrides,
    },
  });
};

export const createProduct = async (overrides: any = {}) => {
  const {
    vendor,
    vendor_id,
    category,
    category_id,
    categoryIds,
    subCategoryId: _legacySubCategoryId,
    subCategory: _legacySubCategory,
    ...dataOverrides
  } = overrides;
  const hasVendorReference = vendor != null || dataOverrides.vendor_id != null;
  const hasCategoryReference =
    category != null ||
    category_id != null ||
    (Array.isArray(categoryIds) && categoryIds.length > 0);
  const vendorRecord = hasVendorReference ? null : await createVendor();
  const categoryRecord = hasCategoryReference ? null : await createCategory();
  const name = dataOverrides.name ?? {
    en: "Test product",
  };
  const slug = dataOverrides.slug ?? buildLocalizedSlugFromLocalizedText(name);
  const imageSlug = typeof slug.en === "string" ? slug.en : uniqueValue("product");
  const resolvedCategoryId = Array.isArray(categoryIds)
    ? categoryIds[0]
    : (category_id ?? category?.id ?? categoryRecord?.id ?? null);

  return prismaClient.product.create({
    data: {
      sku: uniqueValue("sku"),
      slug,
      name,
      weight_grams: 500,
      headline: {
        en: "Test headline",
      },
      full_description: {
        en: "Test description",
      },
      tags: {
        create: [
          {
            tag: {
              create: {
                name: { en: "test" },
                color: "#16a34a",
              },
            },
          },
        ],
      },
      images: buildImageLinkCreate("product", imageSlug),
      category:
        resolvedCategoryId == null
          ? undefined
          : {
              connect: { id: resolvedCategoryId },
            },
      cost_price: 9.9,
      sales_price: 9.9,
      current_stock: 10,
      storefront_visibility: "ACTIVE",
      vendor: {
        connect: { id: vendor_id ?? vendor?.id ?? vendorRecord?.id },
      },
      ...dataOverrides,
    },
  });
};

export const createOrder = async (overrides: any = {}, status: OrderStatus = "PENDING") => {
  const { customer, ...dataOverrides } = overrides;
  const hasCustomerReference = customer != null || dataOverrides.customer_id != null;
  const customerAccount = hasCustomerReference ? null : await createCustomerAccount();

  return prismaClient.order.create({
    data: {
      items_subtotal: 19.9,
      items_discount_amount: 0,
      delivery_fee: 6.9,
      delivery_discount_amount: 0,
      tip_amount: 0,
      tip_percentage: 0,
      charged_total: 26.8,
      vat_rate: 20,
      included_vat_amount: 3.19,
      total_weight_grams: 500,
      payment_provider: "STRIPE",
      status,
      claim_token: uniqueValue("claim"),
      order_details: {
        items: [],
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
      invoice_details: {},
      customer_id: dataOverrides.customer_id ?? customerAccount?.id ?? null,
      ...dataOverrides,
    },
  });
};

export const createVendorReview = async (overrides: any = {}) => {
  const { vendor, reviewer, order, ...dataOverrides } = overrides;
  const vendorRecord = vendor ?? (dataOverrides.vendor_id != null ? null : await createVendor());
  const reviewOrder = order ?? (dataOverrides.order_id != null ? null : await createOrder());

  return prismaClient.review.create({
    data: {
      kind: "VENDOR",
      order_id: dataOverrides.order_id ?? reviewOrder?.id,
      vendor_id: dataOverrides.vendor_id ?? vendorRecord?.id,
      reviewer_name: dataOverrides.reviewer_name ?? "Test Reviewer",
      show_reviewer_name: dataOverrides.show_reviewer_name ?? true,
      rating: 4,
      comment: "Test review",
      ...dataOverrides,
    },
  });
};

export const createProductReview = async (overrides: any = {}) => {
  const { product, reviewer, order, ...dataOverrides } = overrides;
  const productRecord =
    product ?? (dataOverrides.product_id != null ? null : await createProduct());
  const reviewOrder = order ?? (dataOverrides.order_id != null ? null : await createOrder());

  return prismaClient.review.create({
    data: {
      kind: "PRODUCT",
      order_id: dataOverrides.order_id ?? reviewOrder?.id,
      product_id: dataOverrides.product_id ?? productRecord?.id,
      reviewer_name: dataOverrides.reviewer_name ?? "Test Reviewer",
      show_reviewer_name: dataOverrides.show_reviewer_name ?? true,
      rating: 4,
      comment: "Test review",
      ...dataOverrides,
    },
  });
};
