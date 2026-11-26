import "dotenv/config";
import envConfig from "#src/config.ts";
import { ObjectStorage } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { searchProvider } from "#src/integrations/search/search.provider.ts";
import prismaClient from "#src/prisma.ts";

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
  return prismaClient.image.create({
    data: { name: label, alt: en(label), storage_key: storageKey },
  });
};

await prismaClient.$executeRawUnsafe(`
  TRUNCATE "Order", "Review", "Product", "Category", "Vendor", "Image", "Tag",
    "PromotionCode", "LegalDocument", "ProductSearchDocument", "Job"
  RESTART IDENTITY CASCADE
`);

const tags = {
  new: await prismaClient.tag.create({ data: { name: en("New"), color: "#22c55e" } }),
  bestseller: await prismaClient.tag.create({ data: { name: en("Bestseller"), color: "#f59e0b" } }),
};

const categoryDefinitions = [
  { name: "Pantry", color: "#b45309" },
  { name: "Drinks", color: "#0369a1" },
  { name: "Home", color: "#4d7c0f" },
];
const categories: Record<string, number> = {};
for (const { name, color } of categoryDefinitions) {
  const image = await createImage(name, color);
  const category = await prismaClient.category.create({
    data: { name: en(name), slug: en(slugify(name)), image_id: image.id },
  });
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
  const vendor = await prismaClient.vendor.create({
    data: {
      name: definition.name,
      slug: slugify(definition.name),
      slogan: en(definition.slogan),
      story: en(`${definition.name} is a demo vendor created by the seed script.`),
      tags: en(definition.tags),
      is_featured: true,
      images: { create: { image_id: image.id } },
    },
  });
  vendors[definition.name] = vendor.id;
}

const productDefinitions = [
  ["Rolled Oats", "Pantry", "Northwind Goods", 2.4, 4.9, 120, 1000, "#a16207"],
  ["Wildflower Honey", "Pantry", "Northwind Goods", 5.5, 11.9, 40, 450, "#ca8a04"],
  ["Sea Salt Flakes", "Pantry", "Northwind Goods", 1.8, 5.5, 80, 250, "#64748b"],
  ["Cold Brew Coffee", "Drinks", "Harbor & Co", 2.1, 4.5, 60, 330, "#422006"],
  ["Sparkling Lemonade", "Drinks", "Harbor & Co", 1.2, 3.2, 150, 330, "#facc15"],
  ["Herbal Tea Blend", "Drinks", "Northwind Goods", 3.0, 7.9, 0, 100, "#15803d"],
  ["Beeswax Candle", "Home", "Harbor & Co", 6.0, 16.0, 25, 300, "#d97706"],
  ["Linen Tea Towel", "Home", "Harbor & Co", 4.5, 12.5, 35, 120, "#78716c"],
] as const;

const productIds: number[] = [];
for (const [index, definition] of productDefinitions.entries()) {
  const [name, category, vendor, costPrice, salesPrice, stock, weightGrams, color] = definition;
  const image = await createImage(name, color);
  const product = await prismaClient.product.create({
    data: {
      sku: `DEMO-${String(index + 1).padStart(3, "0")}`,
      slug: en(slugify(name)),
      name: en(name),
      headline: en(`${name} from ${vendor}`),
      full_description: en(`${name} is a demo product created by the seed script.`),
      weight_grams: weightGrams,
      is_featured: index < 4,
      category_id: categories[category],
      vendor_id: vendors[vendor],
      cost_price: costPrice,
      sales_price: salesPrice,
      current_stock: stock,
      images: { create: { image_id: image.id } },
      tags: {
        create: [
          ...(index % 3 === 0 ? [{ tag_id: tags.new.id }] : []),
          ...(index < 2 ? [{ tag_id: tags.bestseller.id }] : []),
        ],
      },
    },
  });
  productIds.push(product.id);
}

await prismaClient.promotionCode.create({
  data: { code: "WELCOME10", discount_type: "ITEMS_PERCENT", discount_value: 10 },
});

const legalDocuments = {
  PRIVACY_NOTICE: "Privacy notice",
  ORDER_AND_DELIVERY_TERMS: "Order and delivery terms",
  RETURNS_AND_CANCELLATION: "Returns and cancellation",
  CONTACT_INFORMATION: "Contact information",
};
for (const [key, title] of Object.entries(legalDocuments)) {
  await prismaClient.legalDocument.create({
    data: {
      key,
      title: en(title),
      content: en(`# ${title}\n\nPlaceholder text created by the seed script.`),
    },
  });
}

await searchProvider.invalidateIndex({ productIds });

console.info(
  `Seeded ${productIds.length} products, ${Object.keys(vendors).length} vendors, ${Object.keys(categories).length} categories, ` +
    `promotion code WELCOME10 and ${Object.keys(legalDocuments).length} legal documents.`,
);
await prismaClient.$disconnect();
