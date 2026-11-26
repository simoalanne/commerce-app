import { routeError } from "@rest-rpc/server";

export const AccountDeletionBlockedByPaidOrders = routeError(
  "ACCOUNT_DELETION_BLOCKED_BY_PAID_ORDERS",
  { status: 409 },
);
