"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/Button";
import { TextField } from "@/components/forms/TextField";

import type { SignUpVerificationViewProps } from "./AuthModal.types";

import styles from "./AuthFormFrame.module.css";

export function AuthSignUpVerificationView({
  email,
  verificationCode,
  isPending,
  errorMessage,
  onVerificationCodeChange,
  onSubmit,
  onSwitchMode,
}: SignUpVerificationViewProps) {
  const t = useTranslations("authModal.verify");

  return (
    <div className={styles.frame}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("title")}</h2>
        <p className={styles.subtitle}>{t("subtitle", { email: email || t("fallbackEmail") })}</p>
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <TextField
          id="auth-sign-up-otp"
          label={t("codeLabel")}
          type="text"
          autoComplete="one-time-code"
          value={verificationCode}
          onChange={(event) => onVerificationCodeChange(event.target.value)}
          required
        />

        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        <Button type="submit" label={t("submit")} isLoading={isPending} />
      </form>

      <p className={styles.footer}>
        {t("footerPrompt")}
        <button
          type="button"
          className={styles.footerAction}
          onClick={onSwitchMode}
          disabled={isPending}
        >
          {t("footerAction")}
        </button>
      </p>
    </div>
  );
}
