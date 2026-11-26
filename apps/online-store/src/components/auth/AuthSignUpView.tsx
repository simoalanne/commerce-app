"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import Button from "@/components/Button";
import { TextField } from "@/components/forms/TextField";
import { Link } from "@/i18n/navigation";

import type { SignUpViewProps } from "./AuthModal.types";
import { isValidAuthEmail } from "./authValidation";
import { GoogleAuthButton } from "./GoogleAuthButton";

import styles from "./AuthFormFrame.module.css";

export function AuthSignUpView({
  firstName,
  lastName,
  email,
  password,
  showPassword,
  isPending,
  errorMessage,
  setIsPending,
  setErrorMessage,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onPasswordChange,
  onTogglePasswordVisibility,
  onSubmit,
  onSwitchMode,
}: SignUpViewProps) {
  const t = useTranslations("authModal.signUp");
  const errorT = useTranslations("authModal.errors");
  const [emailErrorMessage, setEmailErrorMessage] = useState<string | null>(null);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);
  const getEmailValidationError = (value: string) => {
    const trimmedEmail = value.trim();
    if (!trimmedEmail) {
      return errorT("emailRequired");
    }

    return isValidAuthEmail(trimmedEmail) ? null : errorT("invalidEmail");
  };
  const getPasswordValidationError = (value: string) =>
    value.length >= 8 ? null : errorT("passwordTooShort");

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
          const nextEmailErrorMessage = getEmailValidationError(email);
          const nextPasswordErrorMessage = getPasswordValidationError(password);

          setEmailErrorMessage(nextEmailErrorMessage);
          setPasswordErrorMessage(nextPasswordErrorMessage);

          if (nextEmailErrorMessage || nextPasswordErrorMessage) {
            return;
          }

          onSubmit();
        }}
      >
        <TextField
          id="auth-sign-up-email"
          label={t("emailLabel")}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            onEmailChange(event.target.value);
            setEmailErrorMessage(null);
          }}
          onBlur={() => setEmailErrorMessage(getEmailValidationError(email))}
          onInvalid={() => setEmailErrorMessage(getEmailValidationError(email))}
          helperText={emailErrorMessage ?? undefined}
          validationState={emailErrorMessage ? "error" : "default"}
          required
        />

        <TextField
          id="auth-sign-up-password"
          label={t("passwordLabel")}
          type={showPassword ? "text" : "password"}
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            onPasswordChange(event.target.value);
            setPasswordErrorMessage(null);
          }}
          onBlur={() => setPasswordErrorMessage(getPasswordValidationError(password))}
          onInvalid={() => setPasswordErrorMessage(getPasswordValidationError(password))}
          minLength={8}
          helperText={passwordErrorMessage ?? undefined}
          validationState={passwordErrorMessage ? "error" : "default"}
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

        <div className={styles.nameFields}>
          <TextField
            id="auth-sign-up-first-name"
            label={t("firstNameLabel")}
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => onFirstNameChange(event.target.value)}
            isOptional
          />

          <TextField
            id="auth-sign-up-last-name"
            label={t("lastNameLabel")}
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => onLastNameChange(event.target.value)}
            isOptional
          />
        </div>

        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        <div id="clerk-captcha" className={styles.captchaSlot} />

        <Button type="submit" label={t("submit")} isLoading={isPending} />

        <p className={styles.privacyNotice}>
          {t.rich("privacyNotice", {
            link: (chunks) => (
              <Link href="/privacy" target="_blank" rel="noreferrer" className={styles.privacyLink}>
                {chunks}
              </Link>
            ),
          })}
        </p>
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
