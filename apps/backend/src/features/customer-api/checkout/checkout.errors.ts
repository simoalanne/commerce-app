import { routeError } from "@rest-rpc/server";
import z from "zod";

export const InsufficientStock = routeError("INSUFFICIENT_STOCK", {
  status: 409,
  data: z.array(
    z.object({
      sku: z.string(),
      availableStock: z.number(),
    }),
  ),
});

export const PurchaseLimitExceeded = routeError("PURCHASE_LIMIT_EXCEEDED", {
  status: 409,
  data: z.array(
    z.object({
      sku: z.string(),
      purchaseLimit: z.int(),
    }),
  ),
});

export const ProductsNotPurchasable = routeError("PRODUCTS_NOT_PURCHASABLE", {
  status: 400,
  data: z.object({
    skus: z.array(z.string()),
  }),
});

export const PriceMismatch = routeError("PRICE_MISMATCH", {
  status: 409,
  data: z.array(
    z.object({
      sku: z.string(),
      newUnitPriceCents: z.int(),
    }),
  ),
});

export const InvalidPromoCode = routeError("INVALID_PROMO_CODE", {
  status: 400,
});

export const AccountExistsForEmail = routeError("ACCOUNT_EXISTS_FOR_EMAIL", {
  status: 409,
});

export const PromoCodeNotFound = routeError("PROMO_CODE_NOT_FOUND", {
  status: 400,
});

export const PromoCodeInactive = routeError("PROMO_CODE_INACTIVE", {
  status: 400,
});

export const PromoCodeNotStarted = routeError("PROMO_CODE_NOT_STARTED", {
  status: 400,
});

export const PromoCodeExpired = routeError("PROMO_CODE_EXPIRED", {
  status: 400,
});

export const PromoCodeUsageLimitReached = routeError("PROMO_CODE_USAGE_LIMIT_REACHED", {
  status: 400,
});

export const PromoCodeMinimumItemsValueNotMet = routeError(
  "PROMO_CODE_MINIMUM_ITEMS_VALUE_NOT_MET",
  {
    status: 400,
    data: z.object({
      minimumItemsValueCents: z.int(),
    }),
  },
);

const promoCodeErrors = [
  PromoCodeNotFound,
  PromoCodeInactive,
  PromoCodeNotStarted,
  PromoCodeExpired,
  PromoCodeUsageLimitReached,
  PromoCodeMinimumItemsValueNotMet,
];

export const isPromoCodeError = (error: unknown) =>
  promoCodeErrors.some((PromoCodeError) => error instanceof PromoCodeError);

// A provider the store offered but the backend no longer has enabled, e.g.
// after a configuration change while the checkout page was open.
export const PaymentProviderUnavailable = routeError("PAYMENT_PROVIDER_UNAVAILABLE", {
  status: 409,
});
