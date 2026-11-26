import type { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError, sqltag as sql } from "@prisma/client/runtime/client";
import { RouteError } from "@rest-rpc/server";
import z from "zod";

import {
  activeStorefrontVendorWhere,
  activeStorefrontProductWhere,
} from "#src/domain/storefrontVisibility.ts";
import logger from "#src/logger.ts";
import { customerRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

import { AccountDeletionBlockedByPaidOrders } from "./account.errors.ts";

const accountRoute = customerRoute.meta({ access: "AUTHENTICATED" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const setSavedCartItems = z
  .array(
    z.object({
      productId: z.int().positive(),
      quantity: z.int().min(1).max(99),
    }),
  )
  .max(99, "Cart can contain at most 99 different items");

const throwBadAccountItemWrite = (
  error: unknown,
  messages: {
    duplicate: string;
    missingTarget: string;
  },
) => {
  if (!(error instanceof PrismaClientKnownRequestError)) {
    throw error;
  }

  if (error.code === "P2002") {
    throw new RouteError("BAD_REQUEST", {
      status: 400,
      message: messages.duplicate,
    });
  }

  if (error.code === "P2003") {
    throw new RouteError("BAD_REQUEST", {
      status: 400,
      message: messages.missingTarget,
    });
  }

  throw error;
};

const assertUniqueProductIds = (items: Array<{ productId: number }>) => {
  const productIds = new Set<number>();

  for (const item of items) {
    if (productIds.has(item.productId)) {
      throw new RouteError("BAD_REQUEST", {
        status: 400,
        message: "Duplicate saved cart product",
      });
    }

    productIds.add(item.productId);
  }
};

const finalizeLocalAccountDeletion = async (
  db: PrismaClient,
  {
    clerkId,
    customerId,
  }: {
    clerkId: string;
    customerId: number;
  },
) =>
  db.$transaction(async (tx) => {
    await tx.$executeRaw(sql`
			UPDATE "Order"
			SET order_details = order_details::jsonb
				|| jsonb_build_object(
					'customer',
					COALESCE(order_details::jsonb->'customer', '{}'::jsonb)
						|| jsonb_build_object(
							'name', 'Deleted customer',
							'email', 'deleted@acme.invalid'
						),
					'delivery',
					COALESCE(order_details::jsonb->'delivery', '{}'::jsonb)
						|| jsonb_build_object(
							'addressLabel', 'Deleted address',
							'city', 'Deleted',
							'instructions', NULL
						)
				)
			WHERE customer_id = ${customerId}
		`);

    await tx.user.deleteMany({
      where: {
        clerk_id: clerkId,
      },
    });
  });

export const accountRoutes = {
  delete: accountRoute
    .delete("/users/account")
    .error(AccountDeletionBlockedByPaidOrders)
    .handler(async ({ context }) => {
      const { authContext, db, auth } = context;

      const paidOrder = await db.order.findFirst({
        where: {
          customer_id: authContext.customerId,
          status: "PAID",
        },
        select: {
          id: true,
        },
      });

      if (paidOrder) {
        throw new AccountDeletionBlockedByPaidOrders();
      }

      await auth.deleteUser(authContext.clerkId);

      try {
        await finalizeLocalAccountDeletion(db, {
          clerkId: authContext.clerkId,
          customerId: authContext.customerId,
        });
      } catch (error) {
        logger.error("Clerk user deleted but local account cleanup failed", {
          clerkId: authContext.clerkId,
          customerId: authContext.customerId,
          error,
        });
      }

      logger.info("User account deleted successfully", {
        userId: authContext.clerkId,
      });
    }),

  setInitialPassword: accountRoute
    .post("/users/account/password")
    .body(
      z.object({
        password: z.string().min(8).max(1024),
      }),
    )
    .handler(async ({ body, context }) => {
      await context.auth.updateUserPassword(context.authContext.clerkId, body.password);
    }),

  getSavedCart: accountRoute.get("/users/account/saved-cart").handler(async ({ context }) => {
    const cartItems = await context.db.customerSavedCartItem.findMany({
      where: {
        customer_account_id: context.authContext.customerId,
        product: activeStorefrontProductWhere(),
      },
      select: {
        product_id: true,
        quantity: true,
        added_at: true,
      },
      orderBy: {
        added_at: "desc",
      },
    });

    return toResponse(
      cartItems.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        addedAt: item.added_at,
      })),
      context.locale,
    );
  }),

  setSavedCart: accountRoute
    .put("/users/account/saved-cart")
    .body(
      z.object({
        items: setSavedCartItems,
      }),
    )
    .handler(async ({ body, context }) => {
      const { db, authContext } = context;
      const { items } = body;

      assertUniqueProductIds(items);

      try {
        await db.$transaction(async (tx) => {
          await tx.customerSavedCartItem.deleteMany({
            where: {
              customer_account_id: authContext.customerId,
            },
          });

          if (items.length > 0) {
            await tx.customerSavedCartItem.createMany({
              data: items.map((item) => ({
                customer_account_id: authContext.customerId,
                product_id: item.productId,
                quantity: item.quantity,
              })),
            });
          }
        });
      } catch (error) {
        throwBadAccountItemWrite(error, {
          duplicate: "Duplicate saved cart product",
          missingTarget: "Saved cart product does not exist",
        });
      }
    }),

  getFavoriteProducts: accountRoute
    .get("/users/account/favorite-products")
    .handler(async ({ context }) => {
      const products = await context.db.customerFavoriteProduct.findMany({
        where: {
          customer_account_id: context.authContext.customerId,
          product: activeStorefrontProductWhere(),
        },
        select: {
          product_id: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      });

      return toResponse(
        products.map((item) => ({
          id: item.product_id,
          addedAt: item.added_at,
        })),
        context.locale,
      );
    }),

  addFavoriteProduct: accountRoute
    .post("/users/account/favorite-products/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      try {
        await context.db.customerFavoriteProduct.create({
          data: {
            customer_account_id: context.authContext.customerId,
            product_id: params.id,
          },
        });
      } catch (error) {
        throwBadAccountItemWrite(error, {
          duplicate: "Product is already favorited",
          missingTarget: "Favorite product does not exist",
        });
      }
    }),

  removeFavoriteProduct: accountRoute
    .delete("/users/account/favorite-products/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      await context.db.customerFavoriteProduct.deleteMany({
        where: {
          customer_account_id: context.authContext.customerId,
          product_id: params.id,
        },
      });
    }),

  getFavoriteVendors: accountRoute
    .get("/users/account/favorite-vendors")
    .handler(async ({ context }) => {
      const vendors = await context.db.customerFavoriteVendor.findMany({
        where: {
          customer_account_id: context.authContext.customerId,
          vendor: activeStorefrontVendorWhere(),
        },
        select: {
          vendor_id: true,
          added_at: true,
        },
        orderBy: {
          added_at: "desc",
        },
      });

      return toResponse(
        vendors.map((item) => ({
          id: item.vendor_id,
          addedAt: item.added_at,
        })),
        context.locale,
      );
    }),

  addFavoriteVendor: accountRoute
    .post("/users/account/favorite-vendors/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      try {
        await context.db.customerFavoriteVendor.create({
          data: {
            customer_account_id: context.authContext.customerId,
            vendor_id: params.id,
          },
        });
      } catch (error) {
        throwBadAccountItemWrite(error, {
          duplicate: "Vendor is already favorited",
          missingTarget: "Favorite vendor does not exist",
        });
      }
    }),

  removeFavoriteVendor: accountRoute
    .delete("/users/account/favorite-vendors/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      await context.db.customerFavoriteVendor.deleteMany({
        where: {
          customer_account_id: context.authContext.customerId,
          vendor_id: params.id,
        },
      });
    }),

  getPreferences: accountRoute.get("/users/account/preferences").handler(async ({ context }) => {
    const account = await context.db.customerAccount.findUniqueOrThrow({
      where: { id: context.authContext.customerId },
      select: { preferred_locale: true },
    });

    return toResponse({ preferredLocale: account.preferred_locale }, context.locale);
  }),

  setPreferences: accountRoute
    .put("/users/account/preferences")
    .body(
      z.object({
        preferredLocale: z.string(),
      }),
    )
    .handler(async ({ body, context }) => {
      await context.db.customerAccount.update({
        where: { id: context.authContext.customerId },
        data: { preferred_locale: body.preferredLocale },
      });
    }),
};
