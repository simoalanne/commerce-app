import { devPaymentPath } from "./payment.provider.dev.ts";
import { handlePaymentReconciliation } from "./payment.reconciliation.ts";
import { buildCheckoutUrl } from "./payment.redirectUrls.ts";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

export const createDevPaymentRoutes = ({ storeUrl }: { storeUrl: string }) => ({
  [devPaymentPath]: {
    GET: async (request: Request) => {
      const query = new URL(request.url).searchParams;
      const amount = (Number(query.get("amountCents")) / 100).toFixed(2);
      const action = (result: string) =>
        escapeHtml(`${devPaymentPath}?${query.toString()}&result=${result}`);

      return new Response(
        `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test payment</title>
<style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem}
form{display:inline}button{font:inherit;padding:.6rem 1.2rem;margin-right:.5rem;cursor:pointer}</style></head>
<body>
<h1>Test payment</h1>
<p>Order ${escapeHtml(query.get("orderId") ?? "")}: <strong>${amount} €</strong></p>
<p>Development payment provider. No money moves.</p>
<form method="post" action="${action("paid")}"><button>Pay</button></form>
<form method="post" action="${action("canceled")}"><button>Cancel</button></form>
</body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    },

    POST: async (request: Request) => {
      const query = new URL(request.url).searchParams;
      const orderId = Number(query.get("orderId"));
      const result = query.get("result") === "paid" ? "paid" : "canceled";

      await handlePaymentReconciliation({
        provider: "DEV",
        orderId,
        paymentId: query.get("paymentId"),
        result,
      });

      return Response.redirect(
        buildCheckoutUrl({
          redirectBaseUrl: storeUrl,
          locale: query.get("locale") ?? undefined,
          orderId,
          claimToken: query.get("claimToken") ?? "",
          type: result === "paid" ? "success" : "cancel",
        }),
        303,
      );
    },
  },
});
