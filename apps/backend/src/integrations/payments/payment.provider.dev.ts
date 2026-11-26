import { randomUUID } from "node:crypto";

import type { PaymentMetadata, PaymentProvider } from "./payment.provider.ts";

export const devPaymentPath = "/dev-payments/pay";

/**
 * Local development payments: checkout redirects to a backend page with Pay
 * and Cancel buttons, which settle the order through the same reconciliation
 * as a provider callback. Refunds succeed immediately.
 */
export class DevPaymentProvider implements PaymentProvider {
  private readonly apiBaseUrl: string;

  constructor({ apiBaseUrl }: { apiBaseUrl: string }) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async createPayment({
    amountCents,
    metadata,
  }: {
    amountCents: number;
    metadata: PaymentMetadata;
  }) {
    const paymentId = `dev_${randomUUID()}`;
    const redirectUrl = new URL(devPaymentPath, this.apiBaseUrl);
    redirectUrl.searchParams.set("paymentId", paymentId);
    redirectUrl.searchParams.set("orderId", String(metadata.orderId));
    redirectUrl.searchParams.set("claimToken", metadata.claimToken);
    redirectUrl.searchParams.set("amountCents", String(amountCents));
    if (metadata.locale) {
      redirectUrl.searchParams.set("locale", metadata.locale);
    }

    return {
      provider: "DEV" as const,
      paymentId,
      redirectUrl: redirectUrl.toString(),
      amountCents,
    };
  }

  async cancelPayment() {}

  async refundPayment() {
    return { refundId: `dev_refund_${randomUUID()}`, status: "succeeded" as const };
  }
}
