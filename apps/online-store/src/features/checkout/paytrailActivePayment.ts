import type { CheckoutCreatePaymentBody } from "./checkoutTypes";

const paytrailActivePaymentStorageKey = "checkout-paytrail-active-payment";
const paytrailActivePaymentTtlMs = 15 * 60 * 1000;

type PaytrailActivePaymentRecord = {
  redirectUrl: string;
  snapshotHash: string;
  createdAt: number;
};

type PaytrailActivePaymentSnapshot = {
  authEmail: string | null;
  requestBody: CheckoutCreatePaymentBody;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toJSON());
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, nestedValue]) => nestedValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
    .join(",")}}`;
};

const sha256Hex = async (input: string) => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const buildSnapshotHash = async (snapshot: PaytrailActivePaymentSnapshot) =>
  sha256Hex(stableStringify(snapshot));

const readActivePaytrailPayment = (): PaytrailActivePaymentRecord | null => {
  try {
    const rawValue = window.localStorage.getItem(paytrailActivePaymentStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<PaytrailActivePaymentRecord>;
    if (
      typeof parsed.redirectUrl !== "string" ||
      typeof parsed.snapshotHash !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }

    return {
      redirectUrl: parsed.redirectUrl,
      snapshotHash: parsed.snapshotHash,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
};

export const clearActivePaytrailPayment = () => {
  window.localStorage.removeItem(paytrailActivePaymentStorageKey);
};

export const getReusableActivePaytrailRedirectUrl = async ({
  authEmail,
  requestBody,
}: PaytrailActivePaymentSnapshot) => {
  const activePayment = readActivePaytrailPayment();
  if (!activePayment) {
    return null;
  }

  if (Date.now() - activePayment.createdAt > paytrailActivePaymentTtlMs) {
    clearActivePaytrailPayment();
    return null;
  }

  const currentSnapshotHash = await buildSnapshotHash({
    authEmail,
    requestBody,
  });

  if (currentSnapshotHash !== activePayment.snapshotHash) {
    clearActivePaytrailPayment();
    return null;
  }

  return activePayment.redirectUrl;
};

export const saveActivePaytrailPayment = async ({
  authEmail,
  requestBody,
  redirectUrl,
}: PaytrailActivePaymentSnapshot & {
  redirectUrl: string;
}) => {
  const snapshotHash = await buildSnapshotHash({
    authEmail,
    requestBody,
  });

  window.localStorage.setItem(
    paytrailActivePaymentStorageKey,
    JSON.stringify({
      redirectUrl,
      snapshotHash,
      createdAt: Date.now(),
    } satisfies PaytrailActivePaymentRecord),
  );
};
