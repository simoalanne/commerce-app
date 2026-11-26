import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import type z from "zod";

import type { EnvConfig } from "#src/config.ts";
import logger from "#src/logger.ts";

type JwtConfig = Pick<EnvConfig, "JWT_SECRET">;

const getJwtSecret = (config: JwtConfig) => {
  const secret = config.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "missing JWT_SECRET environment variable, which is required to sign subscription confirmation tokens",
    );
  }

  return new TextEncoder().encode(secret);
};

const ALGORITHM = "HS256";

/**
 * Creates a signed JWT token with the given payload and expiration time.
 *
 * @param config - provides JWT_SECRET
 * @param payload - the payload to include in the JWT token
 * @param validForSeconds - the number of seconds the token should be valid for (default is 7 days)
 * @returns a promise that resolves to the signed JWT token as a string
 */
export const createSignedJwt = <TPayload extends JWTPayload>(
  config: JwtConfig,
  payload: TPayload,
  validForSeconds: string | number | Date = "7d",
) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(validForSeconds)
    .sign(getJwtSecret(config));

/**
 *
 * @param config - provides JWT_SECRET
 * @param token - the JWT token to verify
 * @param schema - a Zod schema to validate the payload against
 * @returns a promise containing payload matching schema or null if verification or validation fails
 * @throws if the token is invalid, expired, or if the payload does not match the schema
 */
export const verifyJwtToken = async <TSchema extends z.ZodType>(
  config: JwtConfig,
  token: string,
  schema: TSchema,
) => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(config), {
      algorithms: [ALGORITHM],
    });
    return schema.parse(payload);
  } catch (error) {
    logger.warn("Failed to verify JWT token", error);
    return null;
  }
};
