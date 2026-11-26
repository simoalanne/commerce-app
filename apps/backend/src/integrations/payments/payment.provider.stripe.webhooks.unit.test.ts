import type Stripe from "stripe";

import { createStripeWebhookRoutes } from "./payment.provider.stripe.webhooks.ts";

const payload = JSON.stringify({
  id: "evt_test",
  type: "payment_intent.created",
  data: { object: {} },
});

const stripeRequest = (signature: string) =>
  new Request("http://localhost/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

describe("payment.provider.stripe webhook routes", () => {
  it("passes the raw request body and signature to Stripe", async () => {
    let receivedBody: string | null = null;
    let receivedSignature: string | null = null;

    const stripeClient = {
      webhooks: {
        constructEvent: (body: string, signature: string) => {
          receivedBody = body;
          receivedSignature = signature;
          return { type: "payment_intent.created", data: { object: {} } };
        },
      },
    } as unknown as Stripe;

    const routes = createStripeWebhookRoutes({ stripeClient });
    const response = await routes["/webhooks/stripe"].POST(stripeRequest("sig_test"));

    expect(response.status).toBe(200);
    expect(receivedBody).toBe(payload);
    expect(receivedSignature).toBe("sig_test");
  });

  it("rejects when Stripe signature validation fails", async () => {
    const stripeClient = {
      webhooks: {
        constructEvent: () => {
          throw new Error("invalid signature");
        },
      },
    } as unknown as Stripe;

    const routes = createStripeWebhookRoutes({ stripeClient });

    await expect(routes["/webhooks/stripe"].POST(stripeRequest("sig_bad"))).rejects.toThrow(
      /invalid signature/,
    );
  });
});
