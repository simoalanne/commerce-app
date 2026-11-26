/** Store pages a redirect-based payment returns the customer to. */
export const buildCheckoutUrl = ({
  redirectBaseUrl,
  locale,
  orderId,
  claimToken,
  type,
}: {
  redirectBaseUrl: string;
  locale?: string;
  orderId: number;
  claimToken: string;
  type: "success" | "cancel";
}) => {
  const url = new URL(
    type === "success"
      ? `/${locale ?? "en"}/checkout/success/access-token`
      : `/${locale ?? "en"}/checkout/`,
    redirectBaseUrl,
  );

  if (type === "success") {
    url.searchParams.set("orderId", String(orderId));
    url.searchParams.set("token", claimToken);
  } else {
    url.searchParams.set("paymentCanceled", "1");
  }

  return url.toString();
};
