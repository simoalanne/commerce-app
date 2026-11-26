export const relevantOrderStatuses = ["PAID", "DELIVERED"] as const;

export type RelevantOrderStatus = (typeof relevantOrderStatuses)[number];
