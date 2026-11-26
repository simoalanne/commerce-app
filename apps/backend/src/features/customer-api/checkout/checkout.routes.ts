import { calculateOrderPricing } from "@acme/shared";
import { DeliveryInstructionsSchema } from "@acme/shared/schemas";
import { isValidPhoneNumber } from "@acme/shared/utils/addressValidation";
import * as Sentry from "@sentry/node";
import { isAfter, isBefore } from "date-fns";
import { eq, sql } from "drizzle-orm";
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
import { toResponse } from "#src/routing/toResponse.ts";
import { findCustomerIdByEmail } from "#src/utils/findCustomerIdByEmail.ts";
import { NotFoundError } from "#src/utils/notFoundError.ts";
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
  promoCode: z.string().trim().min(1).max(1024).optional(),
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
        customer_id: customerId,
        has_been_linked_to_customer_account: customerId != null,
        items_subtotal_cents: pricingSnapshot.itemsSubtotalCents,
        items_discount_cents: pricingSnapshot.itemsDiscountCents ?? 0,
        charged_total_cents: pricingSnapshot.chargedTotalCents,
        vat_rate: pricingSnapshot.vatRate,
        included_vat_cents: pricingSnapshot.includedVatCents,
        payment_provider: provider,
        order_details: orderDetails,
        invoice_details: getCompanyDetails(config),
        applied_promo_code: validatedPromoCode ? promoCode : null,
        total_weight_grams: orderItems.reduce(
          (sum, item) => sum + item.weightGrams * item.quantity,
          0,
        ),
        preferred_locale: context.locale,
      })
      .returning();
    await tx.insert(orderItemTable).values(
      orderItems.map((item) => ({
        order_id: order.id,
        sku: item.sku,
        name: item.productName,
        quantity: item.quantity,
        unit_cost_price_cents: item.unitCostPriceCents,
        unit_sales_price_cents: item.unitPriceCents,
        product_id: item.productId,
        vendor_id: item.vendorId,
        vendor_name: item.vendorName,
      })),
    );

    await context.jobQueue.enqueue(tx, {
      type: "expirePendingOrder",
      payload: { orderId: order.id },
      delayMs: config.PENDING_ORDER_EXPIRY_MINUTES * 60 * 1000,
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
        claimToken: order.claim_token,
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
        .set({ payment_id: payment.paymentId })
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
    where: { RAW: (t) => sql`lower(${t.code}) = lower(${promoCode})` },
  });

  if (!promo) {
    throw new PromoCodeNotFound();
  }

  const now = new Date();

  if (!promo.is_active) {
    throw new PromoCodeInactive();
  }

  if (promo.valid_from && isBefore(now, promo.valid_from)) {
    throw new PromoCodeNotStarted();
  }

  if (promo.valid_until && isAfter(now, promo.valid_until)) {
    throw new PromoCodeExpired();
  }

  if (promo.usage_limit && promo.times_used >= promo.usage_limit) {
    throw new PromoCodeUsageLimitReached();
  }

  const minimumItemsValueCents = promo.minimum_items_value_cents;

  if (minimumItemsValueCents && itemsSubtotalCents < minimumItemsValueCents) {
    throw new PromoCodeMinimumItemsValueNotMet({
      data: { minimumItemsValueCents },
    });
  }

  return {
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
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
        return toResponse(await createPaymentInternal(context, body), context.locale);
      } catch (error) {
        await releaseCheckoutCreatePaymentRateLimit({
          authContext: context.authContext,
          recipientEmail: body.recipient.email,
        });
        throw error;
      }
    }),
  getPaymentMethods: customerRoute.get("/checkout/payment-methods").handler(async ({ context }) =>
    toResponse(
      {
        // The registry's keys are provider names; Object.keys only knows string.
        providers: Object.keys(context.payments) as PaymentProviderName[],
        paytrailMethods: context.payments.PAYTRAIL
          ? await getCachedPaytrailPaymentMethods(context.config)
          : [],
      },
      context.locale,
    ),
  ),
  validatePromoCode: customerRoute
    .post("/checkout/validate-promo-code")
    .body(
      z.object({
        promoCode: z.string().trim().min(1).max(1024),
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
      return toResponse(await getValidatedPromoCode(context.db, body), context.locale);
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
        columns: { status: true, payment_id: true },
      });

      if (!order) {
        throw new NotFoundError("Order payment status not found");
      }

      return toResponse(
        {
          isPaid: (relevantOrderStatuses as readonly string[]).includes(order.status),
        },
        context.locale,
      );
    }),
};
