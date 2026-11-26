export const relevantOrderStatuses = ["PAID", "SHIPPED"] as const;

export type RelevantOrderStatus = (typeof relevantOrderStatuses)[number];
