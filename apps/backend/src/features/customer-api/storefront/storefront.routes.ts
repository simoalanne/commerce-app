import {
  activeStorefrontVendorWhere,
  activeStorefrontProductWhere,
} from "#src/domain/storefrontVisibility.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
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
          is_featured: true,
          updated_at: true,
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
          updated_at: true,
        },
        orderBy: { id: "asc" },
      }),
      db.query.product.findMany({
        where: activeStorefrontProductWhere(),
        columns: {
          id: true,
          slug: true,
          name: true,
          is_featured: true,
          vendor_id: true,
          category_id: true,
          updated_at: true,
        },
        with: { images: FIRST_LINKED_IMAGE_SELECT },
        orderBy: { id: "asc" },
      }),
    ]);

    return toResponse(
      {
        vendors: vendors.map(({ images, updated_at, is_featured, ...vendor }) => ({
          ...vendor,
          isFeatured: is_featured,
          updatedAt: updated_at,
          imageUrl: getFirstLinkedImageUrl(context.storage, images),
        })),
        categories: categories.map(({ updated_at, ...category }) => ({
          ...category,
          updatedAt: updated_at,
        })),
        products: products.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          isFeatured: product.is_featured,
          updatedAt: product.updated_at,
          vendorId: product.vendor_id,
          categoryId: product.category_id,
          imageUrl: getFirstLinkedImageUrl(context.storage, product.images),
        })),
      },
      context.locale,
    );
  }),
};
