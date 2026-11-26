import { customerRoute } from "#src/routing/base.ts";

import { accountRoutes } from "./account.routes.ts";
import { addressesRoutes } from "./addresses.routes.ts";
import { buildCustomerDataExport } from "./exportData.ts";

export const userRoutes = {
  account: accountRoutes,
  addresses: addressesRoutes,
  exportData: customerRoute
    .meta({ access: "AUTHENTICATED" })
    .get("/user/export-data")
    .handler(async ({ context }) => {
      const identity = await context.auth.getUserById(context.authContext.clerkId);
      const exportData = await buildCustomerDataExport(context, context.authContext.customerId, {
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
      });

      return exportData;
    }),
};
