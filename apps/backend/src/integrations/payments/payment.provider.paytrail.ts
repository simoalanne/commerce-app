import { randomUUID } from "node:crypto";

import logger from "#src/logger.ts";

import { calculateHmac } from "./payment.provider.paytrail.signature.ts";
import type { PaymentMetadata, PaymentProvider, RefundedPayment } from "./payment.provider.ts";
import { buildCheckoutUrl } from "./payment.redirectUrls.ts";

type PaytrailCreatePaymentRequest = {
  stamp: string;
  reference: string;
  amount: number;
  currency: string;
  language: string;
  customer: {
    email: string;
  };
  redirectUrls: {
    success: string;
    cancel: string;
  };
  callbackUrls: {
    success: string;
    cancel: string;
  };
};

type PaytrailCreatePaymentResponse = {
  transactionId?: string;
  href?: string;
};

type PaytrailRefundPaymentRequest = {
  amount: number;
  email: string;
  refundStamp: string;
  refundReference: string;
  callbackUrls: {
    success: string;
    cancel: string;
  };
};

type PaytrailRefundPaymentResponse = {
  transactionId?: string;
  status?: string;
};

const isConclusivePaytrailRefundRejection = (status: number) =>
  status === 400 || status === 404 || status === 422;

// Paytrail's checkout languages.
const getSupportedLocale = (locale?: string) => {
  if (locale === "fi") return "FI";
  if (locale === "sv") return "SV";
  return "EN";
};

export class PaytrailPaymentProvider implements PaymentProvider {
  private readonly merchantId: number;
  private readonly merchantName: string;
  private readonly secretKey: string;
  private readonly callbackBaseUrl: string;
  private readonly redirectBaseUrl: string;

  constructor({
    merchantId,
    merchantName,
    secretKey,
    callbackBaseUrl,
    redirectBaseUrl,
  }: {
    merchantId: number;
    merchantName: string;
    secretKey: string;
    callbackBaseUrl: string;
    redirectBaseUrl: string;
    apiBaseUrl?: string;
  }) {
    this.merchantId = merchantId;
    this.merchantName = merchantName;
    this.secretKey = secretKey;
    this.callbackBaseUrl = callbackBaseUrl;
    this.redirectBaseUrl = redirectBaseUrl;
  }

  private buildPaymentCallbackUrl() {
    return new URL("/webhooks/paytrail/payment", this.callbackBaseUrl).toString();
  }

  private buildRefundCallbackUrl() {
    return new URL("/webhooks/paytrail/refund", this.callbackBaseUrl).toString();
  }

  private getHeaders(
    method: "POST",
    body: string,
    extraHeaders: Record<string, string> = {},
  ): Record<string, string | number> {
    const currentDate = new Date().toISOString();
    const headers: Record<string, string | number> = {
      "checkout-account": this.merchantId,
      "checkout-algorithm": "sha256",
      "checkout-method": method,
      "checkout-nonce": randomUUID(),
      "checkout-timestamp": currentDate,
      ...extraHeaders,
    };
    headers.signature = calculateHmac(this.secretKey, headers, body);
    headers["platform-name"] = this.merchantName;
    return headers;
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
    const callbackUrl = this.buildPaymentCallbackUrl();
    const request: PaytrailCreatePaymentRequest = {
      stamp: randomUUID(),
      reference: String(metadata.orderId),
      amount: amountCents,
      currency: currency.toUpperCase(),
      language: getSupportedLocale(metadata.locale),
      customer: {
        email: receiptEmail ?? "customer@example.com",
      },
      redirectUrls: {
        success: buildCheckoutUrl({
          redirectBaseUrl: this.redirectBaseUrl,
          locale: metadata.locale,
          orderId: metadata.orderId,
          claimToken: metadata.claimToken,
          type: "success",
        }),
        cancel: buildCheckoutUrl({
          redirectBaseUrl: this.redirectBaseUrl,
          locale: metadata.locale,
          orderId: metadata.orderId,
          claimToken: metadata.claimToken,
          type: "cancel",
        }),
      },
      callbackUrls: {
        success: callbackUrl,
        cancel: callbackUrl,
      },
    };
    const body = JSON.stringify(request);
    const headers = this.getHeaders("POST", body);
    const response = await fetch("https://services.paytrail.com/payments", {
      method: "POST",
      headers: {
        ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])),
        "content-type": "application/json",
      },
      body,
    });

    const responseBodyText = await response.text();

    if (!response.ok) {
      logger.error(
        `Failed to create Paytrail payment. Status: ${response.status}, Body: ${responseBodyText}`,
      );
      throw new Error("PAYTRAIL_PAYMENT_CREATION_FAILED");
    }

    const payment = responseBodyText
      ? (JSON.parse(responseBodyText) as PaytrailCreatePaymentResponse | null)
      : null;

    if (!payment?.transactionId || !payment.href) {
      logger.error(
        `Failed to create Paytrail payment. Status: ${response.status}, Body: ${responseBodyText}`,
      );
      throw new Error("PAYTRAIL_PAYMENT_CREATION_FAILED");
    }

    return {
      provider: "PAYTRAIL" as const,
      paymentId: payment.transactionId,
      transactionId: payment.transactionId,
      redirectUrl: payment.href,
      amountCents,
    };
  }

  async cancelPayment(): Promise<void> {
    throw new Error("PAYTRAIL_CANCEL_PAYMENT_NOT_SUPPORTED");
  }

  async refundPayment({
    paymentId,
    amountCents,
    receiptEmail,
    refundId,
    refundKey,
  }: {
    paymentId: string;
    amountCents: number;
    receiptEmail: string;
    orderId: number;
    refundId: number;
    refundKey: string;
  }): Promise<RefundedPayment> {
    const callbackUrl = this.buildRefundCallbackUrl();
    const request: PaytrailRefundPaymentRequest = {
      amount: amountCents,
      email: receiptEmail,
      refundStamp: refundKey,
      refundReference: String(refundId),
      callbackUrls: {
        success: callbackUrl,
        cancel: callbackUrl,
      },
    };

    const body = JSON.stringify(request);
    const headers = this.getHeaders("POST", body, {
      "checkout-transaction-id": paymentId,
    });
    const logRefundError = (message: string, context: Record<string, unknown> = {}) => {
      logger.error(message, {
        tag: "paytrail-refund",
        paymentId,
        refundId,
        ...context,
      });
    };

    try {
      const response = await fetch(`https://services.paytrail.com/payments/${paymentId}/refund`, {
        method: "POST",
        headers: {
          ...Object.fromEntries(
            Object.entries(headers).map(([key, value]) => [key, String(value)]),
          ),
          "content-type": "application/json",
        },
        body,
      });
      const responseBodyText = await response.text();
      const responseContext = {
        status: response.status,
        body: responseBodyText,
      };

      if (!response.ok) {
        const status = isConclusivePaytrailRefundRejection(response.status)
          ? "failed"
          : "requires_manual_review";
        logRefundError("Paytrail refund request was rejected", {
          ...responseContext,
          refundStatus: status,
        });
        return {
          status,
          reason: responseBodyText,
        };
      }

      const refund = responseBodyText
        ? (JSON.parse(responseBodyText) as PaytrailRefundPaymentResponse | null)
        : null;

      if (!refund?.transactionId || !refund.status) {
        logRefundError("Paytrail refund response was missing required fields", responseContext);
        return {
          status: "requires_manual_review",
          reason: responseBodyText,
        };
      }

      const refundContext = {
        ...responseContext,
        providerRefundId: refund.transactionId,
      };

      if (refund.status === "fail") {
        logRefundError("Paytrail refund failed", refundContext);
        return {
          status: "failed",
          reason: responseBodyText,
        };
      }

      if (refund.status !== "ok" && refund.status !== "pending" && refund.status !== "delayed") {
        logRefundError("Paytrail refund response had unknown status", refundContext);
        return {
          status: "requires_manual_review",
          reason: responseBodyText,
        };
      }

      if (refund.status === "ok") {
        return {
          refundId: refund.transactionId,
          status: "succeeded",
        };
      }

      return {
        refundId: refund.transactionId,
        status: "pending",
      };
    } catch (error) {
      logRefundError("Paytrail refund result could not be determined", {
        error,
      });
      return {
        status: "requires_manual_review",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
