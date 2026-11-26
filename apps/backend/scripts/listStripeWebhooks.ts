import "dotenv/config";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set in .env");
}
const stripe = new Stripe(secretKey);

const existingEndpoints = await stripe.webhookEndpoints.list();

console.table(
  existingEndpoints.data.map((endpoint) => ({
    id: endpoint.id,
    url: endpoint.url,
    enabled_events: endpoint.enabled_events.join(", "),
    secretKey: endpoint.secret,
  })),
);
