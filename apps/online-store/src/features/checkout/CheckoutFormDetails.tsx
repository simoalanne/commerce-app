import { isValidPhoneNumber, isValidPostalCode } from "@acme/shared/utils/addressValidation";
import type {} from "@rest-rpc/core";
import { isDefinedError } from "@rest-rpc/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AddressForm, type AddressFormValue } from "@/components/address-form";
import { createInitialAddress } from "@/components/address-form/createInitialAddress";
import { AuthModal } from "@/components/auth/AuthModal";
import Button from "@/components/Button";
import { Modal } from "@/components/Modal";
import { SavedAddress } from "@/components/SavedAddress";
import { useAuth, useUser } from "@/features/auth/clerk";
import { useApiClient } from "@/providers/ApiClientProvider";
import type { CustomerAddress } from "@/types/api";

import { buildCartItemsFromCheckoutItems, type CheckoutCartProductItem } from "./cartState";
import { CheckoutContactSection } from "./CheckoutContactSection";
import type { CheckoutPaymentAdjustmentError } from "./CheckoutPaymentAdjustmentModal";
import { CheckoutPaymentMethodSection } from "./CheckoutPaymentMethodSection";
import { CheckoutTermsAcceptance, type CheckoutTermsDocument } from "./CheckoutTermsAcceptance";
import type { PaymentOptions } from "./checkoutTypes";
import type { CheckoutFormState, CheckoutPromoCodeState } from "./checkoutTypes";
import FormSection from "./FormSection";
import {
  getReusableActivePaytrailRedirectUrl,
  saveActivePaytrailPayment,
} from "./paytrailActivePayment";

import styles from "./CheckoutFormDetails.module.css";

const paymentMethodFieldId = "checkout-payment-method-picker";

const fieldErrorTargetIds = {
  email: "checkout-email",
  phone: "checkout-phone",
  firstName: "checkout-first-name",
  lastName: "checkout-last-name",
  street: "address-form-address",
  postalCode: "address-form-postal-code",
  city: "address-form-city",
  paymentProvider: paymentMethodFieldId,
} as const;

type CheckoutFieldErrors = Record<keyof typeof fieldErrorTargetIds, string | null>;

const emptyFieldErrors: CheckoutFieldErrors = {
  email: null,
  phone: null,
  firstName: null,
  lastName: null,
  street: null,
  postalCode: null,
  city: null,
  paymentProvider: null,
};

interface CheckoutFormDetailsProps {
  cartItems: CheckoutCartProductItem[];
  formState: CheckoutFormState;
  setFormState: (updater: (current: CheckoutFormState) => CheckoutFormState) => void;
  appliedPromoCode: string | null;
  submitError: string | null;
  setSubmitError: (err: string | null) => void;
  invalidatePromoCode: () => void;
  paymentOptions: PaymentOptions;
  onAdjustmentRequired: (error: CheckoutPaymentAdjustmentError) => void;
  persistRecoveryDraft: (
    formState: CheckoutFormState,
    promoCodeState: CheckoutPromoCodeState,
  ) => void;
  promoCodeState: CheckoutPromoCodeState;
  termsDocument: CheckoutTermsDocument;
}

export default function CheckoutFormDetails({
  cartItems,
  formState,
  setFormState,
  appliedPromoCode,
  submitError,
  setSubmitError,
  invalidatePromoCode,
  paymentOptions,
  onAdjustmentRequired,
  persistRecoveryDraft,
  promoCodeState,
  termsDocument,
}: CheckoutFormDetailsProps) {
  const t = useTranslations("checkout");
  const tAddressForm = useTranslations("addressForm");
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { queryUtils } = useApiClient();
  const cart = buildCartItemsFromCheckoutItems(cartItems);
  const [addressDraft, setAddressDraft] = useState<AddressFormValue>(() =>
    createInitialAddress(formState.deliveryAddress),
  );
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>(emptyFieldErrors);
  const createPayment = useMutation(queryUtils.checkout.createPayment.mutationOptions());
  const { data: savedAddresses = [] } = useQuery(
    queryUtils.user.addresses.list.queryOptions({
      enabled: isSignedIn ?? false,
      select: (response) => response.body,
    }),
  );
  const [isExistingAccountModalOpen, setIsExistingAccountModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const updateFormState = (updater: (current: CheckoutFormState) => CheckoutFormState) => {
    setFormState((current) => updater(current));
    setSubmitError(null);
  };

  useEffect(() => {
    setAddressDraft(createInitialAddress(formState.deliveryAddress));
  }, [formState.deliveryAddress]);

  useEffect(() => {
    setFieldErrors((current) => ({
      ...current,
      email: current.email && formState.email.trim() ? null : current.email,
      phone: current.phone && isValidPhoneNumber(formState.phone) ? null : current.phone,
      firstName: current.firstName && formState.firstName.trim() ? null : current.firstName,
      lastName: current.lastName && formState.lastName.trim() ? null : current.lastName,
      street: current.street && addressDraft.street.trim() ? null : current.street,
      postalCode: current.postalCode && addressDraft.postalCode.trim() ? null : current.postalCode,
      city: current.city && addressDraft.city.trim() ? null : current.city,
      paymentProvider:
        current.paymentProvider && formState.paymentProvider ? null : current.paymentProvider,
    }));
  }, [
    addressDraft.city,
    addressDraft.postalCode,
    addressDraft.street,
    formState.email,
    formState.firstName,
    formState.lastName,
    formState.paymentProvider,
    formState.phone,
  ]);

  const normalizeAddress = (address: AddressFormValue): AddressFormValue => ({
    ...address,
    street: address.street.trim(),
    postalCode: address.postalCode.trim(),
    city: address.city.trim(),
    apartment: address.apartment?.trim() || null,
    deliveryInstructions: {
      ...address.deliveryInstructions,
      freeForm: address.deliveryInstructions.freeForm?.trim() || undefined,
    },
  });

  const getPhoneValidationError = (phone: string) => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      return t("form.errors.requiredField", {
        fieldLabel: t("form.contact.phone"),
      });
    }

    return isValidPhoneNumber(trimmedPhone) ? null : t("form.contact.invalidPhone");
  };

  const validatePhone = (phone: string) => {
    setFieldErrors((current) => ({
      ...current,
      phone: getPhoneValidationError(phone),
    }));
  };

  const validatePostalCode = (postalCode: string) => {
    if (!postalCode) {
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      postalCode: isValidPostalCode(postalCode) ? null : t("form.address.invalidPostalCode"),
    }));
  };

  const buildSavedAddressLine = (savedAddress: CustomerAddress) =>
    [savedAddress.street, savedAddress.streetNumber].filter(Boolean).join(" ");

  const addressMatchesSavedAddress = (address: AddressFormValue, savedAddress: CustomerAddress) => {
    const normalizedAddress = normalizeAddress(address);

    return (
      normalizedAddress.street === buildSavedAddressLine(savedAddress).trim() &&
      normalizedAddress.postalCode === savedAddress.postalCode.trim() &&
      normalizedAddress.city === savedAddress.city.trim() &&
      (normalizedAddress.apartment ?? "") === (savedAddress.apartment ?? "") &&
      (normalizedAddress.deliveryInstructions.freeForm ?? "") ===
        (savedAddress.deliveryInstructions.freeForm ?? "")
    );
  };

  const applySavedAddress = (savedAddress: CustomerAddress) => {
    const nextAddress = createInitialAddress({
      street: buildSavedAddressLine(savedAddress),
      city: savedAddress.city,
      postalCode: savedAddress.postalCode,
      addressType: null,
      streetNumber: null,
      entrance: null,
      floor: null,
      apartment: savedAddress.apartment,
      deliveryInstructions: {
        freeForm: savedAddress.deliveryInstructions.freeForm,
      },
    });

    setAddressDraft(nextAddress);
    validatePostalCode(nextAddress.postalCode.trim());
  };

  const scrollToFirstFieldError = (errors: CheckoutFieldErrors) => {
    for (const [fieldName, errorMessage] of Object.entries(errors) as Array<
      [keyof typeof fieldErrors, string | null]
    >) {
      if (!errorMessage) {
        continue;
      }

      const element = document.getElementById(fieldErrorTargetIds[fieldName]);
      if (!element) {
        continue;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus({ preventScroll: true });
        return;
      }

      if (element instanceof HTMLElement) {
        element.focus({ preventScroll: true });
        return;
      }
    }
  };

  const handleContinueToPayment = async (continueAsGuest: boolean) => {
    const email = formState.email.trim();
    const phone = formState.phone.trim();
    const firstName = formState.firstName.trim();
    const lastName = formState.lastName.trim();
    const deliveryAddress = normalizeAddress(addressDraft);
    const requiredFieldError = (fieldLabel: string) =>
      t("form.errors.requiredField", { fieldLabel });
    const nextFieldErrors = {
      email: email ? null : requiredFieldError(t("form.contact.email")),
      phone: getPhoneValidationError(phone),
      firstName: firstName ? null : requiredFieldError(t("form.contact.firstName")),
      lastName: lastName ? null : requiredFieldError(t("form.contact.lastName")),
      street: deliveryAddress.street ? null : requiredFieldError(tAddressForm("address")),
      postalCode: deliveryAddress.postalCode
        ? fieldErrors.postalCode
        : requiredFieldError(tAddressForm("postalCode")),
      city: deliveryAddress.city ? null : requiredFieldError(tAddressForm("city")),
      paymentProvider: formState.paymentProvider
        ? null
        : requiredFieldError(t("form.payment.title")),
    };

    setFieldErrors(nextFieldErrors);

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setSubmitError(null);
      scrollToFirstFieldError(nextFieldErrors);
      return;
    }

    setSubmitError(null);
    const paymentProvider = formState.paymentProvider;
    if (!paymentProvider) {
      return;
    }

    setFormState((current) => ({
      ...current,
      email,
      phone,
      firstName,
      lastName,
      deliveryAddress,
    }));

    const nextFormState = {
      ...formState,
      email,
      phone,
      firstName,
      lastName,
      deliveryAddress,
    };
    const paymentRequest = {
      provider: paymentProvider,
      cart,
      deliveryAddress,
      recipient: {
        email,
        phone,
        firstName,
        lastName,
      },
      promoCode: appliedPromoCode ?? undefined,
      continueAsGuest,
    };
    const authEmail = user?.primaryEmailAddress?.emailAddress ?? null;

    persistRecoveryDraft(nextFormState, promoCodeState);

    const reusableRedirectUrl = await getReusableActivePaytrailRedirectUrl({
      authEmail,
      requestBody: paymentRequest,
    });

    if (reusableRedirectUrl) {
      window.location.href = reusableRedirectUrl;
      return;
    }

    try {
      const paymentResult = await createPayment.mutateAsync({
        body: paymentRequest,
      });
      const response = paymentResult.body;

      if (response.provider !== paymentProvider) {
        setSubmitError(
          `Backend returned different payment provider than requested: ${response.provider}`,
        );
        return;
      }

      if (response.provider === "STRIPE") {
        setSubmitError(
          `Unsupported payment provider for online-store checkout: ${response.provider}`,
        );
        return;
      }

      if (response.provider === "PAYTRAIL") {
        await saveActivePaytrailPayment({
          authEmail,
          requestBody: paymentRequest,
          redirectUrl: response.redirectUrl,
        });
      }

      window.location.href = response.redirectUrl;
    } catch (error) {
      const paymentError = isDefinedError(error, queryUtils.checkout.createPayment.fetch)
        ? error
        : null;

      if (
        paymentError?.code === "PRODUCTS_NOT_PURCHASABLE" ||
        paymentError?.code === "PRICE_MISMATCH" ||
        paymentError?.code === "INSUFFICIENT_STOCK" ||
        paymentError?.code === "PURCHASE_LIMIT_EXCEEDED"
      ) {
        onAdjustmentRequired(paymentError);
        return;
      }

      if (paymentError?.code === "INVALID_PROMO_CODE") {
        invalidatePromoCode();
        setSubmitError(null);
        return;
      }

      if (paymentError?.code === "RATE_LIMIT_EXCEEDED") {
        setSubmitError(t("form.errors.tooManyRequests"));
        return;
      }

      if (paymentError?.code === "ACCOUNT_EXISTS_FOR_EMAIL") {
        setSubmitError(null);
        setIsExistingAccountModalOpen(true);
        return;
      }

      setSubmitError(t("form.errors.paymentPreparationFailed"));
    }
  };

  return (
    <>
      <CheckoutContactSection
        state={formState}
        emailError={fieldErrors.email}
        phoneError={fieldErrors.phone}
        firstNameError={fieldErrors.firstName}
        lastNameError={fieldErrors.lastName}
        setState={(updater) =>
          updateFormState((current) => ({
            ...current,
            ...updater(current),
          }))
        }
        onPhoneBlur={() => validatePhone(formState.phone)}
      />
      <FormSection title={t("form.address.title")}>
        {savedAddresses.length > 0 ? (
          <div className={styles.savedAddressesSection}>
            <div className={styles.savedAddressesRail}>
              {savedAddresses.map((savedAddress) => (
                <SavedAddress
                  key={savedAddress.id}
                  address={buildSavedAddressLine(savedAddress)}
                  postalCode={savedAddress.postalCode}
                  city={savedAddress.city}
                  selected={addressMatchesSavedAddress(addressDraft, savedAddress)}
                  onClick={() => applySavedAddress(savedAddress)}
                />
              ))}
            </div>
          </div>
        ) : null}
        <AddressForm
          address={addressDraft}
          setAddress={setAddressDraft}
          onPostalCodeValidate={validatePostalCode}
          errors={{
            street: fieldErrors.street,
            postalCode: fieldErrors.postalCode,
            city: fieldErrors.city,
          }}
        />
      </FormSection>
      <CheckoutPaymentMethodSection
        id={paymentMethodFieldId}
        paymentOptions={paymentOptions}
        selectedProvider={formState.paymentProvider}
        errorMessage={fieldErrors.paymentProvider}
        onSelect={(paymentProvider) =>
          updateFormState((current) => {
            const nextPaymentProvider =
              current.paymentProvider === paymentProvider ? null : paymentProvider;
            return {
              ...current,
              paymentProvider: nextPaymentProvider,
            };
          })
        }
      />
      {submitError ? <p className={styles.inlineError}>{submitError}</p> : null}
      <div className={styles.actionRow}>
        <CheckoutTermsAcceptance document={termsDocument} submitLabel={t("form.continue")} />
        <Button
          type="button"
          className={styles.submitButton}
          label={t("form.continue")}
          isLoading={createPayment.isPending}
          onClick={() => void handleContinueToPayment(false)}
        />
      </div>

      <Modal
        open={isExistingAccountModalOpen}
        onOpenChange={setIsExistingAccountModalOpen}
        title={t("existingAccountModal.title")}
      >
        <div>
          <p className={styles.existingAccountDescription}>
            {t("existingAccountModal.description")}
          </p>

          <div className={styles.existingAccountModalActions}>
            <button
              type="button"
              onClick={() => {
                setIsExistingAccountModalOpen(false);
                setIsAuthModalOpen(true);
              }}
              className={styles.logInButton}
            >
              {t("existingAccountModal.signIn")}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsExistingAccountModalOpen(false);
                void handleContinueToPayment(true);
              }}
              className={styles.continueAsGuestButton}
            >
              {t("existingAccountModal.continueAsGuest")}
            </button>
          </div>
        </div>
      </Modal>

      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />
    </>
  );
}
