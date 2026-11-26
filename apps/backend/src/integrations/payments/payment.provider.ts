import Stripe from "stripe";

import envConfig from "#src/config.ts";
import logger from "#src/logger.ts";

import { PaytrailPaymentProvider } from "./payment.provider.paytrail.ts";
import { StripePaymentProvider } from "./payment.provider.stripe.ts";

export type PaymentProviderName = "STRIPE" | "PAYTRAIL";

export type PaymentMetadata = {
  orderId: number;
  claimToken: string;
  customerId?: number;
  locale?: string;
};

export type CreatedPayment =
  | {
      provider: "STRIPE";
      paymentId: string;
      paymentIntentClientSecret: string;
      amountCents: number;
    }
  | {
      provider: "PAYTRAIL";
      paymentId: string;
      transactionId: string;
      redirectUrl: string;
      amountCents: number;
    };

export type RefundedPayment =
  | {
      refundId: string;
      status: "succeeded" | "pending";
    }
  | {
      status: "failed" | "requires_manual_review";
      reason: string;
    };

export interface PaymentProvider {
  createPayment(input: {
    amountCents: number;
    currency: "eur";
    receiptEmail?: string;
    metadata: PaymentMetadata;
  }): Promise<CreatedPayment>;
  cancelPayment(paymentId: string): Promise<void>;
  refundPayment(input: {
    paymentId: string;
    amountCents: number;
    receiptEmail: string;
    orderId: number;
    refundId: number;
    refundKey: string;
  }): Promise<RefundedPayment>;
}

const createStubPaymentProvider = (provider: PaymentProviderName) =>
  new Proxy({} as PaymentProvider, {
    get: (target, prop) => {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop);
      }
      throw new Error(`${provider}_PAYMENT_PROVIDER_NOT_CONFIGURED`);
    },
  });

const canEnableStripe = !!envConfig.STRIPE_SECRET_KEY;

if (!canEnableStripe && envConfig.NODE_ENV === "development") {
  logger.warn("Stripe payment provider is disabled and stripe payment features will not work");
}

const stripeProvider = envConfig.STRIPE_SECRET_KEY
  ? new StripePaymentProvider(envConfig.STRIPE_SECRET_KEY)
  : createStubPaymentProvider("STRIPE");

const canEnablePaytrail =
  envConfig.PAYTRAIL_MERCHANT_ID &&
  envConfig.PAYTRAIL_SECRET_KEY &&
  envConfig.API_PUBLIC_URL &&
  envConfig.ONLINE_STORE_URL &&
  envConfig.PAYTRAIL_MERCHANT_NAME;

if (!canEnablePaytrail && envConfig.NODE_ENV === "development") {
  logger.warn("Paytrail payment provider is disabled and paytrail payment features will not work");
}

const paytrailProvider =
  envConfig.PAYTRAIL_MERCHANT_ID &&
  envConfig.PAYTRAIL_SECRET_KEY &&
  envConfig.API_PUBLIC_URL &&
  envConfig.ONLINE_STORE_URL &&
  envConfig.PAYTRAIL_MERCHANT_NAME
    ? new PaytrailPaymentProvider({
        merchantId: envConfig.PAYTRAIL_MERCHANT_ID,
        secretKey: envConfig.PAYTRAIL_SECRET_KEY,
        callbackBaseUrl: envConfig.API_PUBLIC_URL,
        redirectBaseUrl: envConfig.ONLINE_STORE_URL,
        merchantName: envConfig.PAYTRAIL_MERCHANT_NAME,
      })
    : createStubPaymentProvider("PAYTRAIL");

export type PaymentProviders = Record<PaymentProviderName, PaymentProvider>;

export const paymentProviders: PaymentProviders = {
  STRIPE: stripeProvider,
  PAYTRAIL: paytrailProvider,
};

export const getPaymentProvider = (provider: PaymentProviderName) => paymentProviders[provider];

// Imported dynamically due to causing circular dependency issues if they are
// part of the payment provider modules. They are Bun routes: path -> method.
export const getWebhookRoutes = async (): Promise<
  Record<string, Partial<Record<"GET" | "POST", (request: Request) => Promise<Response>>>>
> => ({
  ...(envConfig.STRIPE_SECRET_KEY
    ? (await import("./payment.provider.stripe.webhooks.ts")).createStripeWebhookRoutes({
        stripeClient: new Stripe(envConfig.STRIPE_SECRET_KEY),
      })
    : {}),
  ...(envConfig.PAYTRAIL_SECRET_KEY
    ? (await import("./payment.provider.paytrail.callbacks.ts")).createPaytrailCallbackRoutes({
        secretKey: envConfig.PAYTRAIL_SECRET_KEY,
      })
    : {}),
});
