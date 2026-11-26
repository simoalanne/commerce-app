export const createStripeMock = (overrides: any = {}) => ({
  paymentIntents: {
    create: async () => ({
      id: "pi_test",
      client_secret: "secret_test",
      ...overrides.paymentIntent,
    }),
    cancel: async () => ({ id: "pi_test", status: "canceled" }),
    list: async () => ({ data: [] }),
  },
  webhooks: {
    constructEvent: () => overrides.event ?? { type: "payment_intent.succeeded" },
  },
  ...overrides,
});

export const createClerkMock = (overrides: any = {}) => ({
  users: {
    getUser: async (userId: string) => ({
      id: userId,
      firstName: "Test",
      lastName: "User",
      primaryEmailAddressId: "email_test",
      emailAddresses: [{ id: "email_test", emailAddress: "test@example.com" }],
      ...overrides.user,
    }),
    deleteUser: async () => undefined,
    ...overrides.users,
  },
});

export const createWebhookNotificationMock = () => {
  const calls: Array<{ event: string; payload: unknown }> = [];

  return {
    calls,
    notify: async (event: string, payload: unknown) => {
      calls.push({ event, payload });
    },
  };
};
