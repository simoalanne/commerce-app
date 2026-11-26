import Stripe from "stripe";

import envConfig from "#src/config.ts";
import logger from "#src/logger.ts";

import { DevPaymentProvider } from "./payment.provider.dev.ts";
import { PaytrailPaymentProvider } from "./payment.provider.paytrail.ts";
import { StripePaymentProvider } from "./payment.provider.stripe.ts";

export type PaymentProviderName = "STRIPE" | "PAYTRAIL" | "DEV";

export type PaymentMetadata = {
  orderId: number;
  claimToken: string;
  customerId?: number;
  locale?: string;
};

type CreatedPayment =
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
    }
  | {
      provider: "DEV";
      paymentId: string;
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

const paytrailConfig =
  envConfig.PAYTRAIL_MERCHANT_ID &&
  envConfig.PAYTRAIL_SECRET_KEY &&
  envConfig.PAYTRAIL_MERCHANT_NAME
    ? {
        merchantId: envConfig.PAYTRAIL_MERCHANT_ID,
        secretKey: envConfig.PAYTRAIL_SECRET_KEY,
        callbackBaseUrl: envConfig.API_PUBLIC_URL,
        redirectBaseUrl: envConfig.ONLINE_STORE_URL,
        merchantName: envConfig.PAYTRAIL_MERCHANT_NAME,
      }
    : null;

const isDevelopment = envConfig.NODE_ENV === "development";

export type PaymentProviders = Partial<Record<PaymentProviderName, PaymentProvider>>;

/** The enabled providers; checkout offers only these. */
export const paymentProviders: PaymentProviders = {
  ...(envConfig.STRIPE_SECRET_KEY
    ? { STRIPE: new StripePaymentProvider(envConfig.STRIPE_SECRET_KEY) }
    : {}),
  ...(paytrailConfig ? { PAYTRAIL: new PaytrailPaymentProvider(paytrailConfig) } : {}),
  ...(isDevelopment
    ? {
        DEV: new DevPaymentProvider({
          apiBaseUrl: envConfig.API_PUBLIC_URL,
        }),
      }
    : {}),
};

if (isDevelopment) {
  logger.info(`Enabled payment providers: ${Object.keys(paymentProviders).join(", ")}`);
}

/** For orders already placed with a provider, which must still be enabled. */
export const getPaymentProvider = (provider: PaymentProviderName) => {
  const paymentProvider = paymentProviders[provider];
  if (!paymentProvider) {
    throw new Error(`Payment provider ${provider} is not enabled`);
  }
  return paymentProvider;
};

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
  ...(paymentProviders.DEV
    ? (await import("./payment.provider.dev.routes.ts")).createDevPaymentRoutes({
        storeUrl: envConfig.ONLINE_STORE_URL,
      })
    : {}),
});
