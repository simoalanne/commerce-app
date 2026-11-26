import { calculateOrderPricing } from "@acme/shared";
import { DeliveryInstructionsSchema } from "@acme/shared/schemas";
import { isValidPhoneNumber } from "@acme/shared/utils/addressValidation";
import { RouteError } from "@rest-rpc/server";
import * as Sentry from "@sentry/node";
import { isAfter, isBefore } from "date-fns";
import { eq } from "drizzle-orm";
import z from "zod";

import type { Db } from "#src/db/client.ts";
import type { OrderDetails } from "#src/db/json.ts";
import { orderItemTable, orderTable } from "#src/db/schema.ts";
import { getCompanyDetails } from "#src/domain/getCompanyDetails.ts";
import { verifyOrderCapabilityJwt } from "#src/features/customer-api/orders/orderCapabilities.ts";
import type { PaymentProviderName } from "#src/integrations/payments/payment.provider.ts";
import { getCachedPaytrailPaymentMethods } from "#src/integrations/payments/paytrail.paymentMethods.ts";
import { enqueueProductStockInvalidationJobs } from "#src/jobs/handlers/jobAggregrates.ts";
import type { EnqueueJob } from "#src/jobs/queue.ts";
import type { SupportedLocale } from "#src/locales.ts";
import type { AuthContext } from "#src/routing/auth.ts";
import { type AppContext, customerRoute } from "#src/routing/base.ts";
import { MINUTE_MS, type RateLimitPolicy } from "#src/routing/rateLimit.ts";
import { findCustomerIdByEmail } from "#src/utils/findCustomerIdByEmail.ts";
import { relevantOrderStatuses } from "#src/utils/orderStatus.ts";

import { releaseReservedStock, reserveStockOrThrow } from "./checkout.adjustStock.ts";
import {
  AccountExistsForEmail,
  InsufficientStock,
  InvalidPromoCode,
  isPromoCodeError,
  PaymentProviderUnavailable,
  PriceMismatch,
  ProductsNotPurchasable,
  PromoCodeExpired,
  PromoCodeInactive,
  PromoCodeMinimumItemsValueNotMet,
  PromoCodeNotFound,
  PromoCodeNotStarted,
  PromoCodeUsageLimitReached,
  PurchaseLimitExceeded,
} from "./checkout.errors.ts";
import {
  consumeCheckoutCreatePaymentRateLimit,
  releaseCheckoutCreatePaymentRateLimit,
} from "./checkout.rateLimit.ts";
import {
  buildOrderDetails,
  buildOrderItemsFromProducts,
  calculateOrderTotal,
  fetchPurchasableProducts,
  validateCartPurchaseLimits,
  validateCartUnitPrices,
} from "./checkout.utils.ts";

const DeliveryAddressSchema = z.object({
  street: z.string().trim().min(1).max(255),
  city: z.string().trim().min(1).max(255),
  postalCode: z.string().trim().min(1).max(32),
  addressType: z.string().trim().max(255).nullable(),
  streetNumber: z.string().trim().max(64).nullable(),
  entrance: z.string().trim().max(64).nullable(),
  floor: z.string().trim().max(64).nullable(),
  apartment: z.string().trim().max(64).nullable(),
  deliveryInstructions: DeliveryInstructionsSchema,
});

const OrderRecipientSchema = z.object({
  email: z.email(),
  phone: z.string().trim().min(1).max(32).refine(isValidPhoneNumber, {
    message: "phone must be a valid phone number",
  }),
  firstName: z.string().trim().min(1).max(255),
  lastName: z.string().trim().min(1).max(255),
});

export const CheckoutCartSchema = z
  .record(
    z.string(),
    z.object({
      quantity: z.int().min(1, "Quantity must be at least 1").max(99, "Quantity cannot exceed 99"),
      unitPriceCents: z.int().nonnegative(),
    }),
  )
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Cart cannot be empty",
  });

const baseCreatepaymentBodySchema = z.object({
  cart: CheckoutCartSchema,
  deliveryAddress: DeliveryAddressSchema,
  recipient: OrderRecipientSchema,
  promoCode: z.string().trim().toUpperCase().min(1).max(1024).optional(),
  continueAsGuest: z.boolean().optional(),
});

const createPaymentBodySchema = z.discriminatedUnion("provider", [
  baseCreatepaymentBodySchema.extend({
    provider: z.literal("STRIPE"),
  }),
  baseCreatepaymentBodySchema.extend({
    provider: z.literal("PAYTRAIL"),
  }),
  baseCreatepaymentBodySchema.extend({
    provider: z.literal("DEV"),
  }),
]);

type CreatePaymentBody = z.output<typeof createPaymentBodySchema>;

type CheckoutContext = AppContext & {
  authContext: AuthContext;
  locale: SupportedLocale;
};

const createPaymentInternal = async (
  context: CheckoutContext,
  { cart, deliveryAddress, recipient, provider, promoCode, continueAsGuest }: CreatePaymentBody,
) => {
  const { authContext, db, config, payments } = context;
  const paymentProvider = payments[provider];
  if (!paymentProvider) {
    throw new PaymentProviderUnavailable();
  }

  const customerId = authContext.isAuthenticated
    ? authContext.customerId
    : await findCustomerIdByEmail({ db, auth: context.auth }, recipient.email);

  if (!authContext.isAuthenticated && customerId !== null && continueAsGuest !== true) {
    throw new AccountExistsForEmail();
  }

  const products = await fetchPurchasableProducts(db, Object.keys(cart));

  validateCartPurchaseLimits(products, cart);
  validateCartUnitPrices(products, cart);

  const orderItems = buildOrderItemsFromProducts(products, cart, context.locale);
  const itemsSubtotalCents = calculateOrderTotal(orderItems);

  const validatedPromoCode = !promoCode
    ? null
    : await getValidatedPromoCodeForPayment(db, {
        promoCode,
        itemsSubtotalCents,
      }).catch((error) => {
        if (isPromoCodeError(error)) {
          throw new InvalidPromoCode();
        }
        throw error;
      });

  const pricingSnapshot = calculateOrderPricing({
    itemsSubtotalCents,
    discountType: validatedPromoCode?.discountType,
    discountValue: validatedPromoCode?.discountValue,
  });

  const orderDetails: OrderDetails = buildOrderDetails({
    deliveryAddress,
    recipient,
  });

  const order = await db.transaction(async (tx) => {
    await reserveStockOrThrow({
      items: orderItems,
      transaction: tx,
    });
    const [order] = await tx
      .insert(orderTable)
      .values({
        customerId,
        hasBeenLinkedToCustomerAccount: customerId != null,
        itemsSubtotalCents: pricingSnapshot.itemsSubtotalCents,
        itemsDiscountCents: pricingSnapshot.itemsDiscountCents ?? 0,
        chargedTotalCents: pricingSnapshot.chargedTotalCents,
        vatRate: pricingSnapshot.vatRate,
        includedVatCents: pricingSnapshot.includedVatCents,
        paymentProvider: provider,
        orderDetails,
        invoiceDetails: getCompanyDetails(config),
        appliedPromoCode: validatedPromoCode ? promoCode : null,
        totalWeightGrams: orderItems.reduce(
          (sum, item) => sum + item.weightGrams * item.quantity,
          0,
        ),
        preferredLocale: context.locale,
      })
      .returning();
    await tx.insert(orderItemTable).values(
      orderItems.map((item) => ({
        orderId: order.id,
        sku: item.sku,
        name: item.productName,
        quantity: item.quantity,
        unitCostPriceCents: item.unitCostPriceCents,
        unitSalesPriceCents: item.unitPriceCents,
        productId: item.productId,
        vendorId: item.vendorId,
        vendorName: item.vendorName,
      })),
    );

    await context.jobQueue.enqueue(tx, {
      type: "expirePendingOrder",
      payload: { orderId: order.id },
      options: { startAfter: config.PENDING_ORDER_EXPIRY_MINUTES * 60 },
    });

    return order;
  });

  Sentry.getCurrentScope().setContext("order", { orderId: order.id });

  const amountCents = pricingSnapshot.chargedTotalCents;

  try {
    const payment = await paymentProvider.createPayment({
      amountCents,
      currency: "eur",
      receiptEmail: recipient.email,
      metadata: {
        orderId: order.id,
        claimToken: order.claimToken,
        locale: context.locale,
        ...(customerId != null ? { customerId } : {}),
      },
    });

    Sentry.getCurrentScope().setContext("order", {
      orderId: order.id,
      paymentId: payment.paymentId,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(orderTable)
        .set({ paymentId: payment.paymentId })
        .where(eq(orderTable.id, order.id));
      const enqueueJob: EnqueueJob = (job) => context.jobQueue.enqueue(tx, job);

      // Stock can be consired stale once stock is reserved AND payment is successfully created.
      // Technically theres a small window where stock is reserved but payment creation fails,
      // but because availability in client UI is optimistic anyway this is simplest solution.
      await enqueueProductStockInvalidationJobs({
        productIds: orderItems.map((item) => item.productId),
        enqueueJob,
      });
    });

    if (payment.provider === "STRIPE") {
      return {
        provider: "STRIPE" as const,
        orderId: order.id,
        paymentIntentClientSecret: payment.paymentIntentClientSecret,
        amountCents: payment.amountCents,
      };
    }

    return {
      provider: payment.provider,
      orderId: order.id,
      redirectUrl: payment.redirectUrl,
      amountCents: payment.amountCents,
    };
  } catch (error) {
    await db.transaction(async (tx) => {
      await tx.delete(orderTable).where(eq(orderTable.id, order.id));

      await releaseReservedStock({
        items: orderItems,
        transaction: tx,
      });
    });
    throw error;
  }
};

const getValidatedPromoCodeForPayment = async (
  db: Db,
  {
    promoCode,
    itemsSubtotalCents,
  }: {
    promoCode: string;
    itemsSubtotalCents: number;
  },
) => {
  try {
    return await getValidatedPromoCode(db, { promoCode, itemsSubtotalCents });
  } catch (error) {
    if (isPromoCodeError(error)) {
      throw new InvalidPromoCode();
    }

    throw error;
  }
};

const getValidatedPromoCode = async (
  db: Db,
  {
    promoCode,
    itemsSubtotalCents,
  }: {
    promoCode: string;
    itemsSubtotalCents: number;
  },
) => {
  const promo = await db.query.promotionCode.findFirst({
    where: { code: promoCode },
  });

  if (!promo) {
    throw new PromoCodeNotFound();
  }

  const now = new Date();

  if (!promo.isActive) {
    throw new PromoCodeInactive();
  }

  if (promo.validFrom && isBefore(now, promo.validFrom)) {
    throw new PromoCodeNotStarted();
  }

  if (promo.validUntil && isAfter(now, promo.validUntil)) {
    throw new PromoCodeExpired();
  }

  if (promo.usageLimit && promo.timesUsed >= promo.usageLimit) {
    throw new PromoCodeUsageLimitReached();
  }

  const minimumItemsValueCents = promo.minimumItemsValueCents;

  if (minimumItemsValueCents && itemsSubtotalCents < minimumItemsValueCents) {
    throw new PromoCodeMinimumItemsValueNotMet({
      data: { minimumItemsValueCents },
    });
  }

  return {
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    minimumItemsValueCents: minimumItemsValueCents ?? null,
  };
};

// Per IP, on top of the per-customer limit in checkout.rateLimit.ts.
const checkoutPaymentRateLimit = {
  name: "checkoutPayment",
  windowMs: 10 * MINUTE_MS,
  max: 25,
} satisfies RateLimitPolicy;

export const checkoutRoutes = {
  // A plain route on purpose: the provider call must not run inside a
  // transaction, so the order is written and compensated in explicit ones.
  createPayment: customerRoute
    .meta({
      access: "OPTIONAL_AUTHENTICATED",
      rateLimit: checkoutPaymentRateLimit,
    })
    .post("/checkout/payment")
    .body(createPaymentBodySchema)
    .error(InsufficientStock)
    .error(PurchaseLimitExceeded)
    .error(ProductsNotPurchasable)
    .error(PriceMismatch)
    .error(InvalidPromoCode)
    .error(AccountExistsForEmail)
    .error(PaymentProviderUnavailable)
    .handler(async ({ body, context }) => {
      await consumeCheckoutCreatePaymentRateLimit({
        authContext: context.authContext,
        recipientEmail: body.recipient.email,
      });

      try {
        return await createPaymentInternal(context, body);
      } catch (error) {
        await releaseCheckoutCreatePaymentRateLimit({
          authContext: context.authContext,
          recipientEmail: body.recipient.email,
        });
        throw error;
      }
    }),
  getPaymentMethods: customerRoute
    .get("/checkout/payment-methods")
    .handler(async ({ context }) => ({
      // The registry's keys are provider names; Object.keys only knows string.
      providers: Object.keys(context.payments) as PaymentProviderName[],
      paytrailMethods: context.payments.PAYTRAIL
        ? await getCachedPaytrailPaymentMethods(context.config)
        : [],
    })),
  validatePromoCode: customerRoute
    .post("/checkout/validate-promo-code")
    .body(
      z.object({
        promoCode: z.string().trim().toUpperCase().min(1).max(1024),
        itemsSubtotalCents: z.int().nonnegative(),
      }),
    )
    .error(PromoCodeNotFound)
    .error(PromoCodeInactive)
    .error(PromoCodeNotStarted)
    .error(PromoCodeExpired)
    .error(PromoCodeUsageLimitReached)
    .error(PromoCodeMinimumItemsValueNotMet)
    .handler(async ({ body, context }) => {
      return await getValidatedPromoCode(context.db, body);
    }),
  // TODO: should work via authContext and orderId as well, not just via short-lived token.
  pollOrderStatus: customerRoute
    .get("/checkout/poll-order-status")
    .query(z.object({ token: z.string().trim().min(1) }))
    .handler(async ({ query, context }) => {
      const capability = await verifyOrderCapabilityJwt(context.config, {
        token: query.token,
        scope: "order:read",
      });
      const order = await context.db.query.order.findFirst({
        where: { id: capability.orderId },
        columns: { status: true, paymentId: true },
      });

      if (!order) {
        throw new RouteError("NOT_FOUND", { status: 404 });
      }

      return {
        isPaid: (relevantOrderStatuses as readonly string[]).includes(order.status),
      };
    }),
};
