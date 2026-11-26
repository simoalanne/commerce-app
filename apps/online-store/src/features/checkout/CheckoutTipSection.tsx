"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { TextField } from "@/components/forms/TextField";
import { formatPrice } from "@/utils/formatPrice";

import styles from "./CheckoutTipSection.module.css";

const TIP_OPTIONS = [10, 15, 20] as const;
const defaultTipPercentage = TIP_OPTIONS[0];
const tipContentId = "checkout-tip-options";

type CheckoutTipSectionProps = {
  tipPercentage: number;
  effectiveItemsSubtotal: number;
  onChange: (tipPercentage: number) => void;
};

type CheckoutTipSelectorProps = {
  value: number;
  effectiveItemsSubtotal: number;
  onChange: (value: number) => void;
};

const getTipAmount = (itemsSubtotal: number, tipPercentage: number) =>
  Math.round(itemsSubtotal * tipPercentage) / 100;

export function CheckoutTipContent({
  value,
  effectiveItemsSubtotal,
  onChange,
}: CheckoutTipSelectorProps) {
  const t = useTranslations("checkout.tip");
  const isEnabled = value > 0;
  const hasPresetValue = TIP_OPTIONS.includes(value as (typeof TIP_OPTIONS)[number]);
  const [customValue, setCustomValue] = useState<string>(isEnabled ? String(value) : "");

  useEffect(() => {
    setCustomValue(isEnabled ? String(value) : "");
  }, [isEnabled, value]);

  const normalizedCustomValue = customValue.trim();
  const parsedCustomValue = useMemo(() => {
    if (!normalizedCustomValue) {
      return null;
    }

    const parsedValue = Number(normalizedCustomValue.replace(",", "."));
    if (Number.isNaN(parsedValue)) {
      return null;
    }

    return Math.max(0, Math.min(100, parsedValue));
  }, [normalizedCustomValue]);
  const hasAppliedCustomValue = !hasPresetValue && value > 0;
  const isCustomValueReady =
    parsedCustomValue !== null && parsedCustomValue > 0 && parsedCustomValue !== value;

  const handleApplyCustomTip = () => {
    if (parsedCustomValue === null || parsedCustomValue <= 0) {
      return;
    }

    onChange(parsedCustomValue);
    setCustomValue(String(parsedCustomValue));
  };

  return (
    <div className={styles.tipSelector}>
      <div className={styles.tipOptions} role="group" aria-label={t("presetOptionsLabel")}>
        {TIP_OPTIONS.map((option) => {
          const isSelected = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                setCustomValue(String(option));
                onChange(option);
              }}
              className={`${styles.tipButton} ${isSelected ? styles.tipButtonSelected : ""}`}
            >
              <span>{`${option}%`}</span>
              <span className={styles.tipButtonAmount}>
                {formatPrice(getTipAmount(effectiveItemsSubtotal, option))}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.customTipRow}>
        <TextField
          id="checkout-tip-custom"
          label={t("customLabel")}
          value={customValue}
          onChange={(event) => {
            setCustomValue(event.target.value.replaceAll(/\D/g, ""));
          }}
          isOptional
          inputMode="numeric"
          className={styles.customTipInput}
          trailingElement={<span aria-hidden="true">%</span>}
        />
        <button
          type="button"
          className={styles.customTipButton}
          onClick={handleApplyCustomTip}
          disabled={!isCustomValueReady}
        >
          {hasAppliedCustomValue ? t("updateAction") : t("saveAction")}
        </button>
      </div>
      <p className={styles.thankYouText}>{t("thankYou")}</p>
    </div>
  );
}

export function CheckoutTipSection({
  tipPercentage,
  effectiveItemsSubtotal,
  onChange,
}: CheckoutTipSectionProps) {
  const t = useTranslations("checkout");
  const isEnabled = tipPercentage > 0;

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>{t("form.tip.title")}</h2>
      <div className={styles.panel}>
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={isEnabled}
          aria-controls={tipContentId}
          onClick={() => onChange(isEnabled ? 0 : defaultTipPercentage)}
        >
          <span
            className={`${styles.checkbox} ${isEnabled ? styles.checkboxSelected : ""}`}
            aria-hidden="true"
          >
            {isEnabled ? <Check size={16} strokeWidth={3} /> : null}
          </span>
          <span className={styles.triggerText}>{t("tip.toggleLabel")}</span>
        </button>

        <div
          id={tipContentId}
          className={`${styles.contentFrame} ${isEnabled ? styles.contentFrameOpen : ""}`}
          inert={isEnabled ? undefined : true}
          aria-hidden={!isEnabled}
        >
          <div className={styles.content}>
            <CheckoutTipContent
              value={tipPercentage}
              effectiveItemsSubtotal={effectiveItemsSubtotal}
              onChange={onChange}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
