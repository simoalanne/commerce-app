import z from "zod";

import type { CartItems } from "./cartState";

export const CART_COOKIE_NAME = "online-store-cart";
const CART_COOKIE_VERSION = 3;

export type CartCookie = {
  version: typeof CART_COOKIE_VERSION;
  items: CartItems;
  updatedAt?: number;
};

const cartCookieSchema: z.ZodType<CartCookie> = z.object({
  version: z.literal(CART_COOKIE_VERSION),
  items: z.record(
    z.string(),
    z.object({
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
    }),
  ),
  updatedAt: z.number().optional(),
});

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    // The document.cookie fallback adapter stores the value URI-encoded,
    // while the Cookie Store API path stores it raw. Server-side reads see
    // whichever form the client wrote, so fall back to the decoded form.
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch {
      return null;
    }
  }
}

export function parseCartCookieValue(rawValue: string | undefined): CartCookie | null {
  if (!rawValue) {
    return null;
  }

  const result = cartCookieSchema.safeParse(tryParseJson(rawValue));
  return result.success ? result.data : null;
}

export function serializeCartCookieValue(cookie: CartCookie) {
  return JSON.stringify(cookie);
}

export function createCartCookieValue({
  items,
  updatedAt,
}: Omit<CartCookie, "version">): CartCookie {
  return {
    version: CART_COOKIE_VERSION,
    items,
    updatedAt: updatedAt ?? Date.now(),
  };
}
