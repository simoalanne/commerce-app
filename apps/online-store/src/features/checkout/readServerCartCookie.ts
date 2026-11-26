import { cookies } from "next/headers";

import { CART_COOKIE_NAME, parseCartCookieValue } from "./cartCookie";

export async function readServerCartCookie() {
  const cookieStore = await cookies();
  return parseCartCookieValue(cookieStore.get(CART_COOKIE_NAME)?.value);
}
