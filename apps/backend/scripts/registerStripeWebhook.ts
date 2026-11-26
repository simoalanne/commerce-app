import "dotenv/config";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set in .env");
}
const stripe = new Stripe(secretKey);

const [, , webhookUrl] = process.argv;

if (!webhookUrl) {
  throw new Error("Webhook URL not provided. Usage: npm run registerStripeWebhook <backend_url>");
}

const urlObj = new URL(webhookUrl);

if (urlObj.protocol !== "https:") {
  throw new Error("Webhook URL must use HTTPS protocol for stripe to reach it later.");
}

const parsedUrl = `${urlObj.origin}/webhooks/stripe`;

const existingEndpoints = await stripe.webhookEndpoints.list();

const existing = existingEndpoints.data.find((endpoint) => endpoint.url === parsedUrl);

let webhookEndpoint: Stripe.WebhookEndpoint;

if (existing) {
  webhookEndpoint = await stripe.webhookEndpoints.update(existing.id, {
    enabled_events: ["payment_intent.succeeded"],
  });
} else {
  webhookEndpoint = await stripe.webhookEndpoints.create({
    url: parsedUrl,
    enabled_events: ["payment_intent.succeeded"],
  });
}
console.info(
  "✅ Webhook registered successfully. Copy the below line to your backend .env file if the secret has changed.",
);

console.info(`STRIPE_WEBHOOK_SECRET=${webhookEndpoint.secret ?? "SAME_AS_BEFORE"}`);
