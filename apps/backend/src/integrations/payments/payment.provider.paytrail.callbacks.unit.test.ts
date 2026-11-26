import assert from "node:assert";

import { describe, it, vi } from "vitest";

import { createPaytrailCallbackRoutes } from "./payment.provider.paytrail.callbacks.ts";
import { calculateHmac } from "./payment.provider.paytrail.signature.ts";

const createSignature = (query: Record<string, string>, secretKey: string) => {
  const hmacParams = Object.fromEntries(
    Object.entries(query).filter(([key]) => key !== "signature"),
  );
  return calculateHmac(secretKey, hmacParams);
};

const loadPaytrailCallbacksModule = async () => {
  const reconciliationCalls: Array<unknown> = [];

  vi.resetModules();
  vi.doMock("./payment.reconciliation.ts", () => ({
    handlePaymentReconciliation: async (event: unknown) => {
      reconciliationCalls.push(event);
    },
  }));
  const module = await import("./payment.provider.paytrail.callbacks.ts");

  return { ...module, reconciliationCalls };
};

const get = (
  routes: ReturnType<typeof createPaytrailCallbackRoutes>,
  query: Record<string, string>,
) =>
  routes["/webhooks/paytrail/payment"].GET(
    new Request(`http://localhost/webhooks/paytrail/payment?${new URLSearchParams(query)}`),
  );

describe("payment.provider.paytrail callback routes", () => {
  it("rejects callback requests without a signature", async () => {
    const routes = createPaytrailCallbackRoutes({ secretKey: "secret" });

    const response = await get(routes, {});

    assert.strictEqual(response.status, 401);
  });

  it("rejects callback requests with an invalid signature", async () => {
    const routes = createPaytrailCallbackRoutes({ secretKey: "secret" });

    const response = await get(routes, {
      "checkout-status": "ok",
      "checkout-reference": "123",
      "checkout-transaction-id": "pt_123",
      signature: "invalid",
    });

    assert.strictEqual(response.status, 401);
  });

  it("dispatches signed callbacks into the reconciliation handler", async () => {
    const { createPaytrailCallbackRoutes, reconciliationCalls } =
      await loadPaytrailCallbacksModule();
    const query = {
      "checkout-status": "ok",
      "checkout-reference": "123",
      "checkout-transaction-id": "pt_123",
    };
    const routes = createPaytrailCallbackRoutes({ secretKey: "secret" });

    const response = await get(routes, {
      ...query,
      signature: createSignature(query, "secret"),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(reconciliationCalls, [
      {
        provider: "PAYTRAIL",
        orderId: 123,
        paymentId: "pt_123",
        result: "paid",
      },
    ]);
  });

  it("dispatches failed callbacks as canceled payment events", async () => {
    const { createPaytrailCallbackRoutes, reconciliationCalls } =
      await loadPaytrailCallbacksModule();
    const query = {
      "checkout-status": "fail",
      "checkout-reference": "123",
      "checkout-transaction-id": "pt_123",
    };
    const routes = createPaytrailCallbackRoutes({ secretKey: "secret" });

    const response = await get(routes, {
      ...query,
      signature: createSignature(query, "secret"),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(reconciliationCalls, [
      {
        provider: "PAYTRAIL",
        orderId: 123,
        paymentId: "pt_123",
        result: "canceled",
      },
    ]);
  });
});
