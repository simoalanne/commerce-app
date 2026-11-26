import type { NextRequest } from "next/server";

import { handleOrderAccessTokenExchangeRoute } from "@/server/orderAccessTokenExchangeRoute";

type RouteContext = {
  params: Promise<{ locale: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  return await handleOrderAccessTokenExchangeRoute(
    request,
    { params },
    {
      scope: "order:review",
      cleanPath: "/review-order",
      cookiePrefix: "review-order-access-token",
    },
  );
}
