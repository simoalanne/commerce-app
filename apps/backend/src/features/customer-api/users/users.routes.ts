import { customerRoute } from "#src/routing/base.ts";

import { accountRoutes } from "./account.routes.ts";
import { addressesRoutes } from "./addresses.routes.ts";

export const userRoutes = {
  account: accountRoutes,
  addresses: addressesRoutes,
  exportData: customerRoute
    .meta({ access: "AUTHENTICATED" })
    .get("/user/export-data")
    .handler(async ({ context }) => {
      const { email, firstName, lastName } = await context.auth.getUserById(
        context.authContext.clerkId,
      );
      const account = await context.db.query.customerAccount.findFirst({
        where: { id: context.authContext.customerId },
        columns: {},
        with: {
          customerSavedCartItems: true,
          customerFavoriteProducts: true,
          customerFavoriteVendors: true,
          addresses: true,
          orders: {
            // Cost prices and the claim token are not the customer's data.
            columns: { claimToken: false },
            with: {
              orderItems: { columns: { unitCostPriceCents: false } },
              reviews: { with: { images: true } },
            },
          },
        },
      });

      return { email, firstName, lastName, ...account };
    }),
};
