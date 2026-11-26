"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/Button";
import { TextField } from "@/components/forms/TextField";

import type { ClientTrustVerificationViewProps } from "./AuthModal.types";

import styles from "./AuthFormFrame.module.css";

export function AuthClientTrustVerificationView({
  code,
  isPending,
  errorMessage,
  onCodeChange,
  onSubmit,
  onSwitchMode,
}: ClientTrustVerificationViewProps) {
  const t = useTranslations("authModal.clientTrust");

  return (
    <div className={styles.frame}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("title")}</h2>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <TextField
          id="auth-client-trust-code"
          label={t("codeLabel")}
          type="text"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
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
