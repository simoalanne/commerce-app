"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/Button";
import { TextField } from "@/components/forms/TextField";

import type { CheckoutPromoCodeState } from "./checkoutTypes";

import styles from "./CheckoutPromoCodeSection.module.css";

type CheckoutPromoCodeSectionProps = {
  state: CheckoutPromoCodeState;
  setState: (updater: (current: CheckoutPromoCodeState) => CheckoutPromoCodeState) => void;
  validatePromoCode: () => Promise<{ success: true } | { success: false }>;
  clearSubmitError: () => void;
};

export function CheckoutPromoCodeSection({
  state,
  setState,
  validatePromoCode,
  clearSubmitError,
}: CheckoutPromoCodeSectionProps) {
  const t = useTranslations("checkout");
  const hasAppliedCode = state.validatedPromoCode !== null && !!state.appliedCode;
  const validationState = state.validationError ? "error" : hasAppliedCode ? "success" : "default";
  const helperText = state.validationError
    ? state.validationError
    : hasAppliedCode
      ? t("form.promoCode.applied")
      : "\u00A0";

  const handleApply = async () => {
    clearSubmitError();
    await validatePromoCode();
  };

  const handleRemove = () => {
    clearSubmitError();
    setState(() => ({
      input: "",
      appliedCode: null,
      validatedPromoCode: null,
      validationError: null,
      isValidating: false,
    }));
  };

  return (
    <div className={styles.section}>
      <div className={styles.controlRow}>
        <div className={styles.inputWrap}>
          <TextField
            id="checkout-promo-code"
            label={t("form.promoCode.label")}
            className={styles.inputControl}
            isOptional
            value={state.input}
            onChange={(event) => {
              clearSubmitError();
              setState((current) => ({
                ...current,
                input: event.target.value.toUpperCase(),
                appliedCode: null,
                validatedPromoCode: null,
                validationError: null,
              }));
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            validationState={validationState}
            helperText={helperText}
          />
        </div>
        <Button
          type="button"
          className={styles.actionButton}
          label={hasAppliedCode ? t("form.promoCode.remove") : t("form.promoCode.apply")}
          isLoading={state.isValidating}
          onClick={() => void (hasAppliedCode ? handleRemove() : handleApply())}
          disabled={hasAppliedCode ? false : !state.input.trim() || state.isValidating}
        />
      </div>
    </div>
  );
}
