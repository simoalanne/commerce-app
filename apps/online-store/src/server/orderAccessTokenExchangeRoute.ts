import { safe } from "@rest-rpc/core";
import { type NextRequest, NextResponse } from "next/server";

import createServerSideApiClient from "@/server/serverApiClient";

type OrderAccessScope = "order:read" | "order:review";

type RouteContext = {
  params: Promise<{ locale: string }>;
};

type OrderAccessTokenExchangeConfig = {
  scope: OrderAccessScope;
  cleanPath: string;
  cookiePrefix: string;
};

const redirectToSameOriginPath = (path: string) =>
  new NextResponse(null, {
    status: 307,
    headers: {
      Location: path,
    },
  });

export async function handleOrderAccessTokenExchangeRoute(
  request: NextRequest,
  { params }: RouteContext,
  config: OrderAccessTokenExchangeConfig,
) {
  const { locale } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const orderId = request.nextUrl.searchParams.get("orderId");
  const format = request.nextUrl.searchParams.get("format");
  const rootPath = `/${locale}`;

  if (!token) {
    return redirectToSameOriginPath(rootPath);
  }

  if (format === "jwt") {
    if (!orderId) {
      return redirectToSameOriginPath(rootPath);
    }

    const cleanPath = `/${locale}${config.cleanPath}?${new URLSearchParams({
      orderId,
    })}`;

    const response = redirectToSameOriginPath(cleanPath);
    response.cookies.set({
      name: `${config.cookiePrefix}-${orderId}`,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  }

  const client = await createServerSideApiClient(Promise.resolve({ locale }));
  const { error, data } = await safe(
    client.orders.createAccessToken(
      {
        body: {
          token,
          scope: config.scope,
        },
      },
      { cache: "no-store" },
    ),
  );

  if (error) {
    return redirectToSameOriginPath(rootPath);
  }

  const cleanPath = `/${locale}${config.cleanPath}?${new URLSearchParams({
    orderId: String(data.body.orderId),
  })}`;

  const response = redirectToSameOriginPath(cleanPath);
  response.cookies.set({
    name: `${config.cookiePrefix}-${data.body.orderId}`,
    value: data.body.accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(data.body.expiresAt),
  });

  return response;
}
