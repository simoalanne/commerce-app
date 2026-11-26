import assert from "node:assert";

import { afterEach, beforeAll, describe, it } from "vitest";

import prismaClient from "#src/prisma.ts";
import { createCategory, createVendor, createProduct } from "#src/tests/factories.ts";

import postgresSearchProvider from "./postgresSearch.provider.ts";

const createdCategoryIds = new Set<number>();
const createdVendorIds = new Set<number>();
const createdProductIds = new Set<number>();

beforeAll(async () => {
  await prismaClient.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
});

afterEach(async () => {
  if (createdProductIds.size > 0) {
    await prismaClient.productSearchDocument.deleteMany({
      where: { product_id: { in: [...createdProductIds] } },
    });
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
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createSearchStoryFixture = async () => {
  const suffix = uniqueSuffix();

  const herbsCategory = await createCategory({
    name: {
      en: "Herbs & Spices",
    },
    slug: {
      en: `herbs-spices-${suffix}`,
    },
  });
  const meatCategory = await createCategory({
    name: { en: "Meat" },
    slug: {
      en: `meat-${suffix}`,
    },
  });
  createdCategoryIds.add(herbsCategory.id);
  createdCategoryIds.add(meatCategory.id);

  const herbVendorSuffix = uniqueSuffix();
  const meatVendorSuffix = uniqueSuffix();

  const herbVendor = await createVendor({
    name: `Lakeside ${herbVendorSuffix}`,
    slug: `lakeside-${suffix}`,
  });
  const meatVendor = await createVendor({
    name: `Hillside Farm ${meatVendorSuffix}`,
    slug: `hillside-farm-${suffix}`,
  });
  createdVendorIds.add(herbVendor.id);
  createdVendorIds.add(meatVendor.id);

  const basil = await createProduct({
    category_id: herbsCategory.id,
    vendor_id: herbVendor.id,
    name: {
      en: "Basil (30g)",
    },
    slug: {
      en: `basil-${suffix}`,
    },
  });
  const coriander = await createProduct({
    category_id: herbsCategory.id,
    vendor_id: herbVendor.id,
    name: {
      en: "Coriander (30g)",
    },
    slug: {
      en: `coriander-${suffix}`,
    },
  });
  const mincedMeat = await createProduct({
    category_id: meatCategory.id,
    vendor_id: meatVendor.id,
    name: {
      en: "Lamb minced meat 500g",
    },
    slug: {
      en: `lamb-minced-meat-${suffix}`,
    },
  });
  createdProductIds.add(basil.id);
  createdProductIds.add(coriander.id);
  createdProductIds.add(mincedMeat.id);

  await postgresSearchProvider.invalidateIndex({
    productIds: [basil.id, coriander.id, mincedMeat.id],
  });

  return {
    herbsCategory,
    meatVendor,
    basil,
    coriander,
    mincedMeat,
  };
};

const search = async (q: string) =>
  await postgresSearchProvider.search({
    q,
    locale: "en",
    limit: 10,
  });

const listIndexedProductIds = async (productId: number) =>
  (
    await prismaClient.productSearchDocument.findMany({
      where: { product_id: productId },
      select: { product_id: true },
    })
  ).map((document) => document.product_id);

describe("PostgresSearchProvider", () => {
  it("indexes visible products through invalidation", async () => {
    const suffix = uniqueSuffix();
    const category = await createCategory({
      name: {
        en: "Index vegetables",
      },
      slug: {
        en: `index-vegetables-${suffix}`,
      },
    });
    createdCategoryIds.add(category.id);
    const vendor = await createVendor({
      name: `Index Farm ${suffix}`,
      slug: `index-farm-${suffix}`,
    });
    createdVendorIds.add(vendor.id);
    const product = await createProduct({
      category_id: category.id,
      vendor_id: vendor.id,
      name: {
        en: "Index carrot",
      },
      slug: {
        en: `index-carrot-${suffix}`,
      },
    });
    createdProductIds.add(product.id);

    await postgresSearchProvider.invalidateIndex({ productIds: [product.id] });

    const documents = await listIndexedProductIds(product.id);
    const result = await search("index carrot");

    assert.deepStrictEqual(documents, [product.id, product.id]);
    assert.deepStrictEqual(
      result.results.products.map((product) => product.id),
      [product.id],
    );
    assert.strictEqual(result.total, 1);
  });

  it("removes stale documents when an affected product becomes hidden", async () => {
    const suffix = uniqueSuffix();
    const category = await createCategory({
      name: {
        en: "Cleanup vegetables",
      },
      slug: {
        en: `cleanup-vegetables-${suffix}`,
      },
    });
    createdCategoryIds.add(category.id);
    const vendor = await createVendor({
      name: `Cleanup Farm ${suffix}`,
      slug: `cleanup-farm-${suffix}`,
    });
    createdVendorIds.add(vendor.id);
    const product = await createProduct({
      category_id: category.id,
      vendor_id: vendor.id,
      name: {
        en: "Cleanup carrot",
      },
      slug: {
        en: `cleanup-carrot-${suffix}`,
      },
    });
    createdProductIds.add(product.id);
    await postgresSearchProvider.invalidateIndex({ productIds: [product.id] });

    await prismaClient.product.update({
      where: { id: product.id },
      data: { storefront_visibility: "INACTIVE" },
    });
    await postgresSearchProvider.invalidateIndex({ productIds: [product.id] });

    const documents = await listIndexedProductIds(product.id);
    const result = await search("cleanup carrot");

    assert.deepStrictEqual(documents, []);
    assert.deepStrictEqual(result.results.products, []);
    assert.strictEqual(result.total, 0);
  });

  it("returns products when the product text matches", async () => {
    const { mincedMeat } = await createSearchStoryFixture();

    const result = await search("minced");

    assert.deepStrictEqual(
      result.results.products.map((product) => product.id),
      [mincedMeat.id],
    );
    assert.deepStrictEqual(result.results.vendors, []);
    assert.deepStrictEqual(result.results.categories, []);
    assert.strictEqual(result.total, 1);
  });

  it("returns vendor and category cards for partial collection matches without returning their products", async () => {
    const { herbsCategory, meatVendor } = await createSearchStoryFixture();

    const vendorResult = await search("hillside");
    const categoryResult = await search("herb");

    assert.deepStrictEqual(vendorResult.results.products, []);
    assert.deepStrictEqual(
      vendorResult.results.vendors.map((vendor) => vendor.id),
      [meatVendor.id],
    );
    assert.deepStrictEqual(vendorResult.results.categories, []);
    assert.strictEqual(vendorResult.total, 0);

    assert.deepStrictEqual(categoryResult.results.products, []);
    assert.deepStrictEqual(categoryResult.results.vendors, []);
    assert.deepStrictEqual(
      categoryResult.results.categories.map((category) => category.id),
      [herbsCategory.id],
    );
    assert.strictEqual(categoryResult.total, 0);
  });

  it("returns collection products when the vendor or category name matches exactly", async () => {
    const { herbsCategory, meatVendor, basil, coriander, mincedMeat } =
      await createSearchStoryFixture();

    const vendorResult = await search(meatVendor.name);
    const categoryResult = await search("Herbs & Spices");

    assert.deepStrictEqual(
      vendorResult.results.products.map((product) => product.id),
      [mincedMeat.id],
    );
    assert.deepStrictEqual(
      vendorResult.results.vendors.map((vendor) => vendor.id),
      [meatVendor.id],
    );
    assert.deepStrictEqual(vendorResult.results.categories, []);
    assert.strictEqual(vendorResult.total, 1);

    assert.deepStrictEqual(
      categoryResult.results.products
        .map((product) => product.id)
        .sort((left, right) => left - right),
      [basil.id, coriander.id].sort((left, right) => left - right),
    );
    assert.deepStrictEqual(categoryResult.results.vendors, []);
    assert.deepStrictEqual(
      categoryResult.results.categories.map((category) => category.id),
      [herbsCategory.id],
    );
    assert.strictEqual(categoryResult.total, 2);
  });
});
