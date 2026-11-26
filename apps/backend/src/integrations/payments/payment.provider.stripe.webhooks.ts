import type Stripe from "stripe";

import envConfig from "#src/config.ts";

import { handlePaymentReconciliation } from "./payment.reconciliation.ts";

export const handlePaymentSucceeded = async (
  paymentIntent: Pick<Stripe.PaymentIntent, "id" | "metadata">,
) => {
  await handlePaymentReconciliation({
    provider: "STRIPE",
    orderId: Number(paymentIntent.metadata.orderId),
    paymentId: paymentIntent.id,
    result: "paid",
  });
};

export const createStripeWebhookRoutes = ({ stripeClient }: { stripeClient: Stripe }) => ({
  "/webhooks/stripe": {
    POST: async (request: Request) => {
      // The signature is computed over the raw body, so it is read as text.
      const event = stripeClient.webhooks.constructEvent(
        await request.text(),
        request.headers.get("stripe-signature") ?? "",
        envConfig.STRIPE_WEBHOOK_SECRET ?? "",
      );

      if (event.type === "payment_intent.succeeded") {
        await handlePaymentSucceeded(event.data.object);
      }

      return new Response("OK");
    },
  },
});
