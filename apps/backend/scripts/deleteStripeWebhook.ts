import "dotenv/config";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set in .env");
}
const stripe = new Stripe(secretKey);

const [, , webhookUrl] = process.argv;

if (!webhookUrl) {
  throw new Error("Webhook URL not provided. Usage: npm run deleteStripeWebhook <backend_url>");
}

const urlObj = new URL(webhookUrl);

if (urlObj.protocol !== "https:") {
  throw new Error("Webhook URL must use HTTPS protocol for stripe to reach it later.");
}

const parsedUrl = `${urlObj.origin}/webhooks/stripe`;

const existingEndpoints = await stripe.webhookEndpoints.list();

const existing = existingEndpoints.data.find((endpoint) => endpoint.url === parsedUrl);

if (existing) {
  await stripe.webhookEndpoints.del(existing.id);
}
console.info("✅ Webhook deleted successfully.");
