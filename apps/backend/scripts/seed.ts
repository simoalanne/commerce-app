import "dotenv/config";
import { sql } from "drizzle-orm";

import envConfig from "#src/config.ts";
import { db } from "#src/db/client.ts";
import {
  categoryTable,
  imageTable,
  legalDocumentTable,
  orderTable,
  productImageTable,
  productSearchDocumentTable,
  productTable,
  productTagTable,
  promotionCodeTable,
  reviewTable,
  tagTable,
  vendorImageTable,
  vendorTable,
} from "#src/db/schema.ts";
import { ObjectStorage } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { searchProvider } from "#src/integrations/search/search.provider.ts";

// Replaces the catalog, orders and content with demo data. Users and admin
// accounts are kept.
if (envConfig.NODE_ENV !== "development") {
  console.error(`Refusing to seed with NODE_ENV=${envConfig.NODE_ENV}; it deletes data.`);
  process.exit(1);
}

const en = <T extends string | string[]>(value: T) => ({ en: value });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const placeholderSvg = (label: string, color: string) =>
  new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">` +
      `<rect width="1200" height="1200" fill="${color}"/>` +
      `<text x="600" y="620" font-family="system-ui,sans-serif" font-size="88" fill="#fff" ` +
      `text-anchor="middle">${label}</text></svg>`,
  );

const createImage = async (label: string, color: string) => {
  const storageKey = `seed/${slugify(label)}.svg`;
  await ObjectStorage.putObject({
    objectKey: storageKey,
    body: placeholderSvg(label, color),
    contentType: "image/svg+xml",
  });
  const [image] = await db
    .insert(imageTable)
    .values({ name: label, alt: en(label), storageKey })
    .returning();
  return image;
};

await db.execute(sql`
  TRUNCATE ${orderTable}, ${reviewTable}, ${productTable}, ${categoryTable}, ${vendorTable},
    ${imageTable}, ${tagTable}, ${promotionCodeTable}, ${legalDocumentTable},
    ${productSearchDocumentTable}
  RESTART IDENTITY CASCADE
`);

const createTag = async (name: string, color: string) =>
  (
    await db
      .insert(tagTable)
      .values({ name: en(name), color })
      .returning()
  )[0];

const tags = {
  new: await createTag("New", "#22c55e"),
  bestseller: await createTag("Bestseller", "#f59e0b"),
};

const categoryDefinitions = [
  { name: "Pantry", color: "#b45309" },
  { name: "Drinks", color: "#0369a1" },
  { name: "Home", color: "#4d7c0f" },
];
const categories: Record<string, number> = {};
for (const { name, color } of categoryDefinitions) {
  const image = await createImage(name, color);
  const [category] = await db
    .insert(categoryTable)
    .values({ name: en(name), slug: en(slugify(name)), imageId: image.id })
    .returning();
  categories[name] = category.id;
}

const vendorDefinitions = [
  {
    name: "Northwind Goods",
    slogan: "Everyday staples, done well",
    color: "#7c3aed",
    tags: ["Organic", "Local"],
  },
  {
    name: "Harbor & Co",
    slogan: "Small-batch drinks and home goods",
    color: "#be123c",
    tags: ["Handmade"],
  },
];
const vendors: Record<string, number> = {};
for (const definition of vendorDefinitions) {
  const image = await createImage(definition.name, definition.color);
  const [vendor] = await db
    .insert(vendorTable)
    .values({
      name: definition.name,
      slug: slugify(definition.name),
      slogan: en(definition.slogan),
      story: en(`${definition.name} is a demo vendor created by the seed script.`),
      tags: en([...definition.tags]),
      isFeatured: true,
    })
    .returning();
  await db.insert(vendorImageTable).values({ vendorId: vendor.id, imageId: image.id });
  vendors[definition.name] = vendor.id;
}

const productDefinitions = [
  ["Rolled Oats", "Pantry", "Northwind Goods", 240, 490, 120, 1000, "#a16207"],
  ["Wildflower Honey", "Pantry", "Northwind Goods", 550, 1190, 40, 450, "#ca8a04"],
  ["Sea Salt Flakes", "Pantry", "Northwind Goods", 180, 550, 80, 250, "#64748b"],
  ["Cold Brew Coffee", "Drinks", "Harbor & Co", 210, 450, 60, 330, "#422006"],
  ["Sparkling Lemonade", "Drinks", "Harbor & Co", 120, 320, 150, 330, "#facc15"],
  ["Herbal Tea Blend", "Drinks", "Northwind Goods", 300, 790, 0, 100, "#15803d"],
  ["Beeswax Candle", "Home", "Harbor & Co", 600, 1600, 25, 300, "#d97706"],
  ["Linen Tea Towel", "Home", "Harbor & Co", 450, 1250, 35, 120, "#78716c"],
] as const;

const productIds: number[] = [];
for (const [index, definition] of productDefinitions.entries()) {
  const [name, category, vendor, costPriceCents, salesPriceCents, stock, weightGrams, color] =
    definition;
  const image = await createImage(name, color);
  const [product] = await db
    .insert(productTable)
    .values({
      sku: `DEMO-${String(index + 1).padStart(3, "0")}`,
      slug: en(slugify(name)),
      name: en(name),
      headline: en(`${name} from ${vendor}`),
      fullDescription: en(`${name} is a demo product created by the seed script.`),
      weightGrams,
      isFeatured: index < 4,
      categoryId: categories[category],
      vendorId: vendors[vendor],
      costPriceCents,
      salesPriceCents,
      currentStock: stock,
    })
    .returning();
  await db.insert(productImageTable).values({ productId: product.id, imageId: image.id });
  const tagIds = [
    ...(index % 3 === 0 ? [tags.new.id] : []),
    ...(index < 2 ? [tags.bestseller.id] : []),
  ];
  if (tagIds.length > 0) {
    await db
      .insert(productTagTable)
      .values(tagIds.map((tagId) => ({ productId: product.id, tagId })));
  }
  productIds.push(product.id);
}

await db
  .insert(promotionCodeTable)
  .values({ code: "WELCOME10", discountType: "PERCENT", discountValue: 10 });

const legalDocuments = {
  PRIVACY_NOTICE: "Privacy notice",
  ORDER_AND_DELIVERY_TERMS: "Order and delivery terms",
  RETURNS_AND_CANCELLATION: "Returns and cancellation",
  CONTACT_INFORMATION: "Contact information",
};
for (const [key, title] of Object.entries(legalDocuments)) {
  await db.insert(legalDocumentTable).values({
    key,
    title: en(title),
    content: en(`# ${title}\n\nPlaceholder text created by the seed script.`),
  });
}

await searchProvider.invalidateIndex({ productIds });

console.info(
  `Seeded ${productIds.length} products, ${Object.keys(vendors).length} vendors, ${Object.keys(categories).length} categories, ` +
    `promotion code WELCOME10 and ${Object.keys(legalDocuments).length} legal documents.`,
);
await db.$client.end();
