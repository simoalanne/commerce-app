import { isIPv6 } from "node:net";

import { interceptor } from "@rest-rpc/server";
import { Address6 } from "ip-address";
import { RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";

import logger from "#src/logger.ts";

import { RateLimitExceeded } from "./errors.ts";

export const MINUTE_MS = 60 * 1000;

export type RateLimitPolicy = {
  name: string;
  windowMs: number;
  max: number;
};

const limiters = new Map<string, RateLimiterMemory>();

const limiterFor = (policy: RateLimitPolicy) => {
  let limiter = limiters.get(policy.name);
  if (!limiter) {
    limiter = new RateLimiterMemory({
      keyPrefix: policy.name,
      points: policy.max,
      duration: Math.ceil(policy.windowMs / 1000),
    });
    limiters.set(policy.name, limiter);
  }
  return limiter;
};

// One key per IPv6 /56, so addresses from one subnet share a bucket.
export const ipKeyGenerator = (ip: string, ipv6Subnet: number | false = 56) => {
  if (isIPv6(ip)) {
    const address = new Address6(ip);
    if (address.is4()) return address.to4().correctForm();
    if (ipv6Subnet) return new Address6(`${ip}/${ipv6Subnet}`).networkForm();
  }
  return ip;
};

// What the runtime passes to `fetch` after the request. Bun's `server` knows
// the socket address.
type ClientAddressSource = {
  requestIP(request: Request): { address: string } | null;
};

// The address `trustProxyHops` proxies in front of the server saw, counted from
// the socket: 0 is the socket address, 1 the last `x-forwarded-for` entry, and
// so on. Which count is right depends on the host.
const clientIp = (
  request: Request,
  server: ClientAddressSource | undefined,
  trustProxyHops: number,
) => {
  const chain = [
    ...(request.headers.get("x-forwarded-for")?.split(",") ?? []),
    server?.requestIP(request)?.address ?? "unknown",
  ].map((address) => address.trim());
  return chain[Math.max(0, chain.length - 1 - trustProxyHops)] ?? "unknown";
};

const rateLimitHeaders = (policy: RateLimitPolicy, state: RateLimiterRes) => {
  const resetSeconds = Math.max(1, Math.ceil(state.msBeforeNext / 1000));
  return {
    resetSeconds,
    headers: {
      "RateLimit-Policy": `${policy.max};w=${resetSeconds}`,
      "RateLimit-Limit": policy.max.toString(),
      "RateLimit-Remaining": Math.max(0, state.remainingPoints).toString(),
      "RateLimit-Reset": resetSeconds.toString(),
    },
  };
};

// Resolves with the headers to send; throws RateLimitExceeded when the bucket is empty.
const consume = async (policy: RateLimitPolicy, key: string) => {
  try {
    return rateLimitHeaders(policy, await limiterFor(policy).consume(key)).headers;
  } catch (error) {
    // rate-limiter-flexible rejects with its state when the bucket is empty.
    if (error instanceof Error) throw error;
    const { resetSeconds } = rateLimitHeaders(policy, error as RateLimiterRes);
    logger.warn("Rate limit exceeded", {
      tag: "rate-limit",
      policy: policy.name,
    });
    throw new RateLimitExceeded({
      message: "Too many requests, please try again later.",
      headers: { "retry-after": resetSeconds.toString() },
    });
  }
};

// Only routes with their own policy are limited here: expensive or abuse-prone
// public routes. Generic per-IP flood protection belongs at the edge (CDN,
// load balancer), which sees the real client IP and covers every instance;
// these in-memory buckets are per process.
/** Limits routes that declare `meta.rateLimit`, per client IP. */
export const rateLimit = ({ trustProxyHops }: { trustProxyHops: number }) =>
  interceptor(async ({ request, args, route, next }) => {
    const policy = route?.meta?.rateLimit;
    if (!policy) return next();

    const [server] = args as [ClientAddressSource | undefined];
    const key = ipKeyGenerator(clientIp(request, server, trustProxyHops));
    const headers = await consume(policy, key);

    const response = await next();
    // The response's headers may be immutable.
    const limited = new Response(response.body, response);
    for (const [name, value] of Object.entries(headers)) {
      limited.headers.set(name, value);
    }
    return limited;
  });
