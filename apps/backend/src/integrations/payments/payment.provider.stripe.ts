import Stripe from "stripe";

import type { PaymentMetadata, PaymentProvider } from "./payment.provider.ts";

export class StripePaymentProvider implements PaymentProvider {
  private readonly stripeClient: Stripe;

  constructor(secretKey: string) {
    this.stripeClient = new Stripe(secretKey);
  }

  async createPayment({
    amountCents,
    currency,
    receiptEmail,
    metadata,
  }: {
    amountCents: number;
    currency: "eur";
    receiptEmail?: string;
    metadata: PaymentMetadata;
  }) {
    const paymentIntent = await this.stripeClient.paymentIntents.create({
      amount: amountCents,
      currency,
      receipt_email: receiptEmail,
      metadata: {
        orderId: String(metadata.orderId),
        ...(metadata.customerId != null ? { customerId: String(metadata.customerId) } : {}),
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error("STRIPE_PAYMENT_INTENT_CREATION_FAILED");
    }

    return {
      provider: "STRIPE" as const,
      paymentId: paymentIntent.id,
      paymentIntentClientSecret: paymentIntent.client_secret,
      amountCents: paymentIntent.amount,
    };
  }

  async cancelPayment(paymentId: string): Promise<void> {
    await this.stripeClient.paymentIntents.cancel(paymentId);
  }

  async refundPayment(_: {
    paymentId: string;
    amountCents: number;
    receiptEmail: string;
    orderId: number;
    refundId: number;
    refundKey: string;
  }): Promise<never> {
    // TODO: implement once we actually use Stripe for payments.
    throw new Error("STRIPE_REFUND_NOT_SUPPORTED");
  }
}
