import { count, eq } from "drizzle-orm";

import { categoryTable, imageTable, productTable, vendorTable } from "#src/db/schema.ts";
import { activeStorefrontProductAndVendor } from "#src/domain/storefrontVisibility.ts";
import { customerRoute } from "#src/routing/base.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";

export const categoriesRoutes = {
  // Categories with at least one product on the storefront.
  getAll: customerRoute.get("/categories").handler(async ({ context }) => {
    const categories = await context.db
      .select({
        id: categoryTable.id,
        name: categoryTable.name,
        slug: categoryTable.slug,
        imageStorageKey: imageTable.storageKey,
        productCount: count(),
      })
      .from(categoryTable)
      .innerJoin(imageTable, eq(imageTable.id, categoryTable.imageId))
      .innerJoin(productTable, eq(productTable.categoryId, categoryTable.id))
      .innerJoin(vendorTable, eq(vendorTable.id, productTable.vendorId))
      .where(activeStorefrontProductAndVendor())
      .groupBy(categoryTable.id, imageTable.storageKey)
      .orderBy(categoryTable.id);

    return resolveLocalizedFields(
      categories.map(({ imageStorageKey, ...category }) => ({
        ...category,
        imageUrl: context.storage.getPublicUrl(imageStorageKey),
      })),
      context.locale,
    );
  }),
};
