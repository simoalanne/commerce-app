import { routeError } from "@rest-rpc/server";
import z from "zod";

export const Unauthorized = routeError("UNAUTHORIZED", { status: 401 });

export const Forbidden = routeError("FORBIDDEN", {
  status: 403,
  data: z.object({ requiredRole: z.string(), yourRoles: z.string() }),
});

export const RateLimitExceeded = routeError("RATE_LIMIT_EXCEEDED", {
  status: 429,
  headers: z.object({ "retry-after": z.string() }),
});

export const EntityInUse = routeError("ENTITY_IN_USE", { status: 409 });

export const ImageUploadInvalidContentType = routeError("IMAGE_UPLOAD_INVALID_CONTENT_TYPE", {
  status: 400,
});

export const ImageUploadTooLarge = routeError("IMAGE_UPLOAD_TOO_LARGE", {
  status: 413,
});
