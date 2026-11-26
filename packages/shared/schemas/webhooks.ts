import z from "zod";

export const WebhookSubscriptionFormSchema = z.object({
  event: z.string(),
  url: z.string(),
});
