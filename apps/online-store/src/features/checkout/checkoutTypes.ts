import type { InferClientError, InferClientRequest, InferClientResponse } from "@rest-rpc/core";

import type { Api } from "@/api/client";
import type { AddressFormValue } from "@/components/address-form";

export type PaymentOptions = InferClientResponse<Api["checkout"]["getPaymentMethods"]>["body"];

export type PaymentMethod = PaymentOptions["paytrailMethods"][number];

export type DeliveryFeeEstimate = InferClientResponse<
  Api["checkout"]["estimateDeliveryFee"]
>["body"];

export type ValidatedPromoCode = InferClientResponse<Api["checkout"]["validatePromoCode"]>["body"];

export type CreatePaymentError = InferClientError<Api["checkout"]["createPayment"]>;

export type CheckoutCreatePaymentBody = InferClientRequest<
  Api["checkout"]["createPayment"]
>["body"];

export type CheckoutPaymentProvider = CheckoutCreatePaymentBody["provider"];

export type CheckoutFormState = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  deliveryAddress: AddressFormValue | null;
  tipPercentage: number;
  paymentProvider: CheckoutPaymentProvider | null;
};

export type CheckoutPromoCodeState = {
  input: string;
  appliedCode: string | null;
  validatedPromoCode: ValidatedPromoCode | null;
  validationError: string | null;
  isValidating: boolean;
};

export const initialCheckoutFormState: CheckoutFormState = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  deliveryAddress: null,
  tipPercentage: 0,
  paymentProvider: null,
};

export const checkoutRecoveryDraftStorageKey = "checkout-payment-draft";

export const initialCheckoutPromoCodeState: CheckoutPromoCodeState = {
  input: "",
  appliedCode: null,
  validatedPromoCode: null,
  validationError: null,
  isValidating: false,
};

export type CheckoutRecoveryPromoCodeState = {
  appliedCode: string;
  validatedPromoCode: ValidatedPromoCode;
};

export type CheckoutRecoveryDraft = {
  formState: CheckoutFormState;
  promoCodeState: CheckoutRecoveryPromoCodeState | null;
};

export type RevivedCheckoutRecoveryDraft = {
  formState: CheckoutFormState;
  promoCodeState: CheckoutPromoCodeState;
};

export function createCheckoutRecoveryDraft(
  formState: CheckoutFormState,
  promoCodeState: CheckoutPromoCodeState,
): CheckoutRecoveryDraft {
  const recoveredPromoCodeState =
    promoCodeState.appliedCode && promoCodeState.validatedPromoCode
      ? {
          appliedCode: promoCodeState.appliedCode,
          validatedPromoCode: promoCodeState.validatedPromoCode,
        }
      : null;

  return {
    formState,
    promoCodeState: recoveredPromoCodeState,
  };
}

export function reviveCheckoutRecoveryDraft(rawDraft: string): RevivedCheckoutRecoveryDraft | null {
  try {
    const parsed = JSON.parse(rawDraft) as Partial<CheckoutRecoveryDraft>;
    const parsedFormState = parsed.formState;
    const parsedPromoCodeState = parsed.promoCodeState;
    return {
      formState: {
        email: typeof parsedFormState?.email === "string" ? parsedFormState.email : "",
        phone: typeof parsedFormState?.phone === "string" ? parsedFormState.phone : "",
        firstName: typeof parsedFormState?.firstName === "string" ? parsedFormState.firstName : "",
        lastName: typeof parsedFormState?.lastName === "string" ? parsedFormState.lastName : "",
        deliveryAddress: parsedFormState?.deliveryAddress ?? null,
        tipPercentage:
          typeof parsedFormState?.tipPercentage === "number" ? parsedFormState.tipPercentage : 0,
        paymentProvider:
          parsedFormState?.paymentProvider === "PAYTRAIL" ||
          parsedFormState?.paymentProvider === "STRIPE" ||
          parsedFormState?.paymentProvider === "DEV"
            ? parsedFormState.paymentProvider
            : null,
      },
      promoCodeState: {
        input:
          typeof parsedPromoCodeState?.appliedCode === "string"
            ? parsedPromoCodeState.appliedCode
            : "",
        appliedCode:
          typeof parsedPromoCodeState?.appliedCode === "string"
            ? parsedPromoCodeState.appliedCode
            : null,
        validatedPromoCode: parsedPromoCodeState?.validatedPromoCode ?? null,
        validationError: null,
        isValidating: false,
      },
    };
  } catch {
    return null;
  }
}
