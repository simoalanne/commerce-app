import logger from "#src/logger.ts";

import { validateHmac } from "./payment.provider.paytrail.signature.ts";
import type { PaymentProviderName } from "./payment.provider.ts";
import {
  handlePaymentReconciliation,
  handleRefundReconciliation,
  type PaymentReconciliationEvent,
  type RefundReconciliationEvent,
} from "./payment.reconciliation.ts";

const PROVIDER: PaymentProviderName = "PAYTRAIL";

const getStringQueryValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return null;
};

const getHmacParams = (query: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([key]) => key !== "signature")
      .flatMap(([key, value]) => {
        const stringValue = getStringQueryValue(value);
        return stringValue == null ? [] : [[key, stringValue]];
      }),
  );

const toPaymentReconciliationEvent = (
  query: Record<string, unknown>,
): PaymentReconciliationEvent | null => {
  const status = getStringQueryValue(query["checkout-status"]);
  const orderId = Number(getStringQueryValue(query["checkout-reference"]));
  const transactionId = getStringQueryValue(query["checkout-transaction-id"]);

  if (status === "ok") {
    return {
      provider: PROVIDER,
      orderId,
      paymentId: transactionId,
      result: "paid",
    };
  }

  if (status === "fail") {
    return {
      provider: PROVIDER,
      orderId,
      paymentId: transactionId,
      result: "canceled",
    };
  }

  return null;
};

const toRefundReconciliationEvent = (
  query: Record<string, unknown>,
): RefundReconciliationEvent | null => {
  const status = getStringQueryValue(query["checkout-status"]);
  const refundId = Number(getStringQueryValue(query["checkout-reference"]));
  const refundKey = getStringQueryValue(query["checkout-stamp"]);
  const transactionId = getStringQueryValue(query["checkout-transaction-id"]);
  const amountCents = Number(getStringQueryValue(query["checkout-amount"]));

  if (status === "ok") {
    return {
      provider: PROVIDER,
      refundId: Number.isNaN(refundId) ? null : refundId,
      refundKey,
      paymentId: transactionId,
      amountCents,
      result: "succeeded",
    };
  }

  if (status === "fail") {
    return {
      provider: PROVIDER,
      refundId: Number.isNaN(refundId) ? null : refundId,
      refundKey,
      paymentId: transactionId,
      amountCents,
      result: "failed",
    };
  }

  return null;
};

export const createPaytrailCallbackRoutes = ({ secretKey }: { secretKey: string }) => {
  // Returns the verified query, or the response to send when it is not.
  const validateAndExtract = (request: Request) => {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const signature = getStringQueryValue(query.signature);

    if (!signature) {
      return new Response("Unauthorized", { status: 401 });
    }

    const hmacParams = getHmacParams(query);
    if (!validateHmac(hmacParams, signature, secretKey)) {
      logger.error("Received invalid POST request to Paytrail callback endpoint", { query: query });
      return new Response("Unauthorized", { status: 401 });
    }

    return query;
  };

  return {
    "/webhooks/paytrail/payment": {
      GET: async (request: Request) => {
        const query = validateAndExtract(request);
        if (query instanceof Response) return query;

        const event = toPaymentReconciliationEvent(query);

        if (event && !Number.isNaN(event.orderId)) {
          await handlePaymentReconciliation(event);
        }
        return new Response("OK");
      },
    },

    "/webhooks/paytrail/refund": {
      GET: async (request: Request) => {
        const query = validateAndExtract(request);
        if (query instanceof Response) return query;

        const event = toRefundReconciliationEvent(query);

        if (
          event &&
          (event.refundId != null || event.refundKey != null) &&
          !Number.isNaN(event.amountCents)
        ) {
          await handleRefundReconciliation(event);
        }
        return new Response("OK");
      },
    },
  };
};
