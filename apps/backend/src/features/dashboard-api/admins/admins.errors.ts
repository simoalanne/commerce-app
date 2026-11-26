import { routeError } from "@rest-rpc/server";

export const UserNotFound = routeError("USER_NOT_FOUND", { status: 404 });

export const AlreadyAdmin = routeError("ALREADY_ADMIN", { status: 409 });
