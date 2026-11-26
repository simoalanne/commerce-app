"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import Button from "@/components/Button";
import { TextField } from "@/components/forms/TextField";

import type { ResetPasswordVerificationViewProps } from "./AuthModal.types";

import styles from "./AuthFormFrame.module.css";

export function AuthResetPasswordVerificationView({
  email,
  code,
  newPassword,
  confirmPassword,
  showPassword,
  isPending,
  errorMessage,
  onCodeChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onTogglePasswordVisibility,
  onSubmit,
  onSwitchMode,
}: ResetPasswordVerificationViewProps) {
  const t = useTranslations("authModal.resetPasswordVerify");

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
          id="auth-reset-password-code"
          label={t("codeLabel")}
          type="text"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          required
        />

        <TextField
          id="auth-reset-password-new-password"
          label={t("passwordLabel")}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          trailingElement={
            <button
              type="button"
              className={styles.passwordTextFieldToggle}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              onClick={onTogglePasswordVisibility}
              disabled={isPending}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          }
          required
        />

        <TextField
          id="auth-reset-password-confirm-password"
          label={t("confirmPasswordLabel")}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
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
