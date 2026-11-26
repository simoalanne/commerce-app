import { activeStorefrontProductWhere } from "#src/domain/storefrontVisibility.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

export const categoriesRoutes = {
  getAll: customerRoute.get("/categories").handler(async ({ context }) => {
    const categories = await context.db.query.category.findMany({
      columns: { id: true, name: true, slug: true },
      with: {
        image: { columns: { storageKey: true } },
        products: { where: activeStorefrontProductWhere(), columns: { id: true } },
      },
    });

    return toResponse(
      categories
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          imageUrl: context.storage.getPublicUrl(category.image.storageKey),
          productCount: category.products.length,
        }))
        .filter((category) => category.productCount > 0),
      context.locale,
    );
  }),
};
