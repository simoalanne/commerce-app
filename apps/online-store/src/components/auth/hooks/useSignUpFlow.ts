"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useClerk, useSignUp } from "@/features/auth/clerk";
import { getClerkErrorMessage } from "@/utils/getClerkErrorMessage";

import { isValidAuthEmail } from "../authValidation";

type UseSignUpFlowParams = {
  onSuccess?: () => void;
};

export function useSignUpFlow({ onSuccess }: UseSignUpFlowParams = {}) {
  const t = useTranslations("authModal.errors");
  const clerk = useClerk();
  const { signUp } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const togglePasswordVisibility = () => setShowPassword((current) => !current);

  const finalizeSignUp = async () =>
    signUp.finalize({
      navigate: async () => {
        onSuccess?.();
      },
    });

  const submit = async () => {
    if (!clerk.loaded) {
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage(t("emailRequired"));
      return;
    }

    if (!isValidAuthEmail(normalizedEmail)) {
      setErrorMessage(t("invalidEmail"));
      return;
    }

    if (password.length < 8) {
      setErrorMessage(t("passwordTooShort"));
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const { error } = await signUp.password({
        emailAddress: normalizedEmail,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      if (error) {
        setErrorMessage(getClerkErrorMessage(error, t("generic")));
        return;
      }

      if (signUp.status === "complete") {
        const { error: finalizeError } = await finalizeSignUp();

        if (finalizeError) {
          setErrorMessage(getClerkErrorMessage(finalizeError, t("generic")));
          return;
        }

        return;
      }

      const { error: verificationError } = await signUp.verifications.sendEmailCode();

      if (verificationError) {
        setErrorMessage(getClerkErrorMessage(verificationError, t("generic")));
        return;
      }

      setPendingVerification(true);
      setVerificationCode("");
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("generic")));
    } finally {
      setIsPending(false);
    }
  };

  const verifyEmail = async () => {
    if (!clerk.loaded) {
      return;
    }

    const normalizedCode = verificationCode.trim();
    if (!normalizedCode) {
      setErrorMessage(t("verificationCodeRequired"));
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code: normalizedCode,
      });

      if (error) {
        setErrorMessage(getClerkErrorMessage(error, t("generic")));
        return;
      }

      if (signUp.status === "complete") {
        const { error: finalizeError } = await finalizeSignUp();

        if (finalizeError) {
          setErrorMessage(getClerkErrorMessage(finalizeError, t("generic")));
          return;
        }

        return;
      }

      setErrorMessage(t("verificationNotComplete"));
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("generic")));
    } finally {
      setIsPending(false);
    }
  };

  const resetVerification = () => {
    setPendingVerification(false);
    setVerificationCode("");
    setErrorMessage(null);
  };

  return {
    firstName,
    lastName,
    email,
    password,
    verificationCode,
    pendingVerification,
    showPassword,
    isPending,
    errorMessage,
    setFirstName,
    setLastName,
    setEmail,
    setPassword,
    setVerificationCode,
    setIsPending,
    setErrorMessage,
    togglePasswordVisibility,
    submit,
    verifyEmail,
    resetVerification,
  };
}
