"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import type { CheckoutPaymentProvider, PaymentMethod } from "./checkoutTypes";
import FormSection from "./FormSection";

import styles from "./CheckoutPaymentMethodSection.module.css";

const paymentLogoMatchers: Array<{
  key: string;
  matches: (method: PaymentMethod) => boolean;
}> = [
  {
    key: "online-banking",
    matches: (method) => {
      const value = getSearchablePaymentMethodValue(method);
      return (
        /(^|[^a-z0-9])op([^a-z0-9]|$)/i.test(value) ||
        /osuuspankki|nordea|danske|s-pankki|aktia|pop pankki|saastopankki|säästöpankki/i.test(value)
      );
    },
  },
  {
    key: "mobilepay",
    matches: (method) => /mobilepay/i.test(getSearchablePaymentMethodValue(method)),
  },
  {
    key: "card",
    matches: (method) =>
      /visa|mastercard|card|credit|debit/i.test(getSearchablePaymentMethodValue(method)),
  },
  {
    key: "klarna",
    matches: (method) => /klarna/i.test(getSearchablePaymentMethodValue(method)),
  },
];

function getSearchablePaymentMethodValue(method: PaymentMethod) {
  return [method.id, method.name, method.group?.id, method.group?.name].filter(Boolean).join(" ");
}

function getRepresentativePaymentLogos(paymentMethods: PaymentMethod[]) {
  const selectedImageUrls = new Set<string>();

  return paymentLogoMatchers.flatMap((matcher) => {
    const method = paymentMethods.find(
      (candidate) => !selectedImageUrls.has(candidate.imageUrl) && matcher.matches(candidate),
    );

    if (!method) {
      return [];
    }

    selectedImageUrls.add(method.imageUrl);
    return [{ ...method, key: matcher.key }];
  });
}

export function CheckoutPaymentMethodSection({
  paymentMethods,
  selectedProvider,
  onSelect,
  errorMessage,
  id,
}: {
  paymentMethods: PaymentMethod[];
  selectedProvider: CheckoutPaymentProvider | null;
  onSelect: (provider: CheckoutPaymentProvider) => void;
  errorMessage?: string | null;
  id?: string;
}) {
  const t = useTranslations("checkout.form.payment");
  const logos = getRepresentativePaymentLogos(paymentMethods);
  const isSelected = selectedProvider === "PAYTRAIL";

  return (
    <FormSection title={t("title")}>
      <div className={styles.paymentSection}>
        <p className={styles.secureText}>{t("secureDescription")}</p>
        <div className={styles.methodCard}>
          <button
            id={id}
            type="button"
            className={`${styles.methodRow} ${
              isSelected ? styles.methodRowSelected : ""
            } ${errorMessage ? styles.methodRowError : ""}`}
            aria-pressed={isSelected}
            onClick={() => onSelect("PAYTRAIL")}
          >
            <span
              className={`${styles.selectionIndicator} ${
                isSelected ? styles.selectionIndicatorSelected : ""
              }`}
              aria-hidden="true"
            />
            <strong className={styles.methodLabel}>{t("methodLabel")}</strong>
            {logos.length > 0 ? (
              <div className={styles.logoRow} aria-hidden="true">
                {logos.map((method) => (
                  <div
                    key={`${method.key}-${method.id}-${method.imageUrl}`}
                    className={styles.methodLogoWrapper}
                  >
                    <Image
                      src={method.imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className={styles.methodLogo}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </button>
          <div
            className={`${styles.redirectNoticeFrame} ${
              isSelected ? styles.redirectNoticeFrameOpen : ""
            }`}
            aria-hidden={!isSelected}
          >
            <div className={styles.redirectNotice}>
              <p>{t("redirectNotice")}</p>
            </div>
          </div>
        </div>
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      </div>
    </FormSection>
  );
}
