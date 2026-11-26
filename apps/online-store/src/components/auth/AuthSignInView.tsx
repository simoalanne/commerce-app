"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import Button from "@/components/Button";
import { TextField } from "@/components/forms/TextField";

import type { SignInViewProps } from "./AuthModal.types";
import { GoogleAuthButton } from "./GoogleAuthButton";

import styles from "./AuthFormFrame.module.css";

export function AuthSignInView({
  email,
  password,
  showPassword,
  isPending,
  errorMessage,
  setIsPending,
  setErrorMessage,
  onEmailChange,
  onPasswordChange,
  onTogglePasswordVisibility,
  onSubmit,
  onForgotPassword,
  onSwitchMode,
}: SignInViewProps) {
  const t = useTranslations("authModal.signIn");
  const errorT = useTranslations("authModal.errors");

  return (
    <div className={styles.frame}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("title")}</h2>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>

      <GoogleAuthButton
        isPending={isPending}
        setIsPending={setIsPending}
        setErrorMessage={setErrorMessage}
        fallbackErrorMessage={errorT("generic")}
        text={t("google")}
      />

      <p className={styles.separator}>{t("separator")}</p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <TextField
          id="auth-sign-in-email"
          label={t("emailLabel")}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />

        <div className={styles.passwordTextFieldGroup}>
          <button
            type="button"
            className={styles.forgotPasswordButton}
            onClick={onForgotPassword}
            disabled={isPending}
          >
            {t("forgotPassword")}
          </button>
          <TextField
            id="auth-sign-in-password"
            name="password"
            label={t("passwordLabel")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
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
        </div>

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
