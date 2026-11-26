type DeliverInternalWebhookEventPayload = {
  event: string;
  url: string;
  data: Record<string, unknown>;
};

export async function deliverInternalWebhookEvent({
  event,
  url,
  data,
}: DeliverInternalWebhookEventPayload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event,
      data,
      sentAt: new Date(),
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(
      `Webhook delivery to ${url} failed with ${response.status} ${response.statusText}`,
    );
  }
}
