import { activeStorefrontProductWhere } from "#src/domain/storefrontVisibility.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

export const categoriesRoutes = {
  getAll: customerRoute.get("/categories").handler(async ({ context }) => {
    const categories = await context.db.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        image: {
          select: {
            storage_key: true,
          },
        },
        _count: {
          select: {
            products: {
              where: activeStorefrontProductWhere(),
            },
          },
        },
      },
    });

    return toResponse(
      categories
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          imageUrl: context.storage.getPublicUrl(category.image.storage_key),
          productCount: category._count.products,
        }))
        .filter((category) => category.productCount > 0),
      context.locale,
    );
  }),
};
