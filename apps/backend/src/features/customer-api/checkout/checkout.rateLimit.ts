import { RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";

import type { AuthContext } from "#src/routing/auth.ts";
import { RateLimitExceeded } from "#src/routing/errors.ts";

const MINUTE_SECONDS = 60;

export const checkoutCreatePaymentRateLimitPolicy = {
  windowMs: 15 * MINUTE_SECONDS * 1000,
  max: 5,
} as const;

const limiter = new RateLimiterMemory({
  keyPrefix: "checkout-create-payment-success",
  points: checkoutCreatePaymentRateLimitPolicy.max,
  duration: checkoutCreatePaymentRateLimitPolicy.windowMs / 1000,
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const buildCheckoutCreatePaymentRateLimitKey = ({
  authContext,
  recipientEmail,
}: {
  authContext: AuthContext;
  recipientEmail: string;
}) => {
  if (authContext.isAuthenticated) {
    return `customer:${authContext.customerId}`;
  }

  return `recipient:${normalizeEmail(recipientEmail)}`;
};

export const consumeCheckoutCreatePaymentRateLimit = async ({
  authContext,
  recipientEmail,
}: {
  authContext: AuthContext;
  recipientEmail: string;
}) => {
  const key = buildCheckoutCreatePaymentRateLimitKey({
    authContext,
    recipientEmail,
  });

  try {
    await limiter.consume(key);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    const rateLimitState = error as RateLimiterRes;
    throw new RateLimitExceeded({
      message: "Too many requests, please try again later.",
      headers: {
        "retry-after": Math.max(1, Math.ceil(rateLimitState.msBeforeNext / 1000)).toString(),
      },
    });
  }
};

export const releaseCheckoutCreatePaymentRateLimit = async ({
  authContext,
  recipientEmail,
}: {
  authContext: AuthContext;
  recipientEmail: string;
}) => {
  const key = buildCheckoutCreatePaymentRateLimitKey({
    authContext,
    recipientEmail,
  });
  await limiter.reward(key, 1);
};
