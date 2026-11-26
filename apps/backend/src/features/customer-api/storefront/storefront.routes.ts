import {
  activeStorefrontVendorWhere,
  activeStorefrontProductWhere,
} from "#src/domain/storefrontVisibility.ts";
import { customerRoute } from "#src/routing/base.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";
import { FIRST_LINKED_IMAGE_SELECT, getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";

export const storefrontRoutes = {
  // The visible catalog as slugs and ids, for resolving routes and building
  // sitemaps without loading every entity in full.
  getContext: customerRoute.get("/storefront/context").handler(async ({ context }) => {
    const { db } = context;
    const [vendors, categories, products] = await Promise.all([
      db.query.vendor.findMany({
        where: activeStorefrontVendorWhere(),
        columns: {
          id: true,
          slug: true,
          name: true,
          isFeatured: true,
          updatedAt: true,
        },
        with: { images: FIRST_LINKED_IMAGE_SELECT },
        orderBy: { id: "asc" },
      }),
      db.query.category.findMany({
        where: { products: activeStorefrontProductWhere() },
        columns: {
          id: true,
          slug: true,
          name: true,
          updatedAt: true,
        },
        orderBy: { id: "asc" },
      }),
      db.query.product.findMany({
        where: activeStorefrontProductWhere(),
        columns: {
          id: true,
          slug: true,
          name: true,
          isFeatured: true,
          vendorId: true,
          categoryId: true,
          updatedAt: true,
        },
        with: { images: FIRST_LINKED_IMAGE_SELECT },
        orderBy: { id: "asc" },
      }),
    ]);

    return resolveLocalizedFields(
      {
        vendors: vendors.map(({ images, updatedAt, isFeatured, ...vendor }) => ({
          ...vendor,
          isFeatured,
          updatedAt,
          imageUrl: getFirstLinkedImageUrl(context.storage, images),
        })),
        categories: categories.map(({ updatedAt, ...category }) => ({
          ...category,
          updatedAt,
        })),
        products: products.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          isFeatured: product.isFeatured,
          updatedAt: product.updatedAt,
          vendorId: product.vendorId,
          categoryId: product.categoryId,
          imageUrl: getFirstLinkedImageUrl(context.storage, product.images),
        })),
      },
      context.locale,
    );
  }),
};
