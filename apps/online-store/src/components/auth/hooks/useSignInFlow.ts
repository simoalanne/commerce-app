"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useClerk, useSignIn } from "@/features/auth/clerk";
import { getClerkErrorMessage } from "@/utils/getClerkErrorMessage";

type UseSignInFlowParams = {
  onSuccess?: () => void;
};

type ResetPasswordStep = "idle" | "request" | "verify";

export function useSignInFlow({ onSuccess }: UseSignInFlowParams = {}) {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const t = useTranslations("authModal.errors");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetPasswordStep, setResetPasswordStep] = useState<ResetPasswordStep>("idle");
  const [resetPasswordCode, setResetPasswordCode] = useState("");
  const [isResetPasswordCodeVerified, setIsResetPasswordCodeVerified] = useState(false);
  const [resetPasswordNewPassword, setResetPasswordNewPassword] = useState("");
  const [resetPasswordConfirmPassword, setResetPasswordConfirmPassword] = useState("");
  const [needsClientTrustVerification, setNeedsClientTrustVerification] = useState(false);
  const [clientTrustCode, setClientTrustCode] = useState("");

  const togglePasswordVisibility = () => setShowPassword((current) => !current);

  const finalizeSignIn = async () => {
    const { error: finalizeError } = await signIn.finalize({
      navigate: async () => {
        onSuccess?.();
      },
    });

    if (finalizeError) {
      setErrorMessage(getClerkErrorMessage(finalizeError, t("generic")));
    }
  };

  const resetResetPassword = () => {
    setResetPasswordStep("idle");
    setResetPasswordCode("");
    setIsResetPasswordCodeVerified(false);
    setResetPasswordNewPassword("");
    setResetPasswordConfirmPassword("");
    setNeedsClientTrustVerification(false);
    setClientTrustCode("");
    setErrorMessage(null);
    void signIn.reset();
  };

  const startResetPassword = () => {
    setResetPasswordStep("request");
    setResetPasswordCode("");
    setIsResetPasswordCodeVerified(false);
    setResetPasswordNewPassword("");
    setResetPasswordConfirmPassword("");
    setNeedsClientTrustVerification(false);
    setClientTrustCode("");
    setErrorMessage(null);
  };

  const submit = async () => {
    if (!clerk.loaded) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setNeedsClientTrustVerification(false);
    setClientTrustCode("");

    try {
      const { error } = await signIn.password({
        identifier: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(getClerkErrorMessage(error, t("generic")));
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      const status = signIn.status as string;
      if (status === "needs_client_trust") {
        const emailCodeFactor = signIn.supportedSecondFactors.find(
          (factor) => factor.strategy === "email_code",
        );

        if (emailCodeFactor) {
          const { error: sendCodeError } = await signIn.mfa.sendEmailCode();
          if (sendCodeError) {
            setErrorMessage(getClerkErrorMessage(sendCodeError, t("generic")));
            return;
          }
          setNeedsClientTrustVerification(true);
          return;
        }
      }

      setErrorMessage(t("signInAdditionalVerification"));
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("generic")));
    } finally {
      setIsPending(false);
    }
  };

  const submitClientTrustCode = async () => {
    if (!clerk.loaded || !needsClientTrustVerification) {
      return;
    }

    const normalizedCode = clientTrustCode.trim();
    if (!normalizedCode) {
      setErrorMessage(t("verificationCodeRequired"));
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const { error } = await signIn.mfa.verifyEmailCode({
        code: normalizedCode,
      });

      if (error) {
        setErrorMessage(getClerkErrorMessage(error, t("generic")));
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      setErrorMessage(t("verificationNotComplete"));
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("generic")));
    } finally {
      setIsPending(false);
    }
  };

  const sendResetPasswordCode = async () => {
    if (!clerk.loaded) {
      return;
    }

    setIsResetPasswordCodeVerified(false);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage(t("emailRequired"));
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      await signIn.reset();

      const { error: createError } = await signIn.create({
        identifier: normalizedEmail,
      });

      if (createError) {
        setErrorMessage(getClerkErrorMessage(createError, t("generic")));
        return;
      }

      const { error: sendCodeError } = await signIn.resetPasswordEmailCode.sendCode();

      if (sendCodeError) {
        setErrorMessage(getClerkErrorMessage(sendCodeError, t("generic")));
        return;
      }

      setResetPasswordStep("verify");
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("generic")));
    } finally {
      setIsPending(false);
    }
  };

  const submitResetPassword = async () => {
    if (!clerk.loaded) {
      return;
    }

    const normalizedCode = resetPasswordCode.trim();
    if (!normalizedCode) {
      setErrorMessage(t("verificationCodeRequired"));
      return;
    }

    if (resetPasswordNewPassword !== resetPasswordConfirmPassword) {
      setErrorMessage(t("passwordsDoNotMatch"));
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      if (!isResetPasswordCodeVerified) {
        const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({
          code: normalizedCode,
        });

        if (verifyError) {
          setErrorMessage(getClerkErrorMessage(verifyError, t("generic")));
          return;
        }

        setIsResetPasswordCodeVerified(true);
      }

      const { error: submitPasswordError } = await signIn.resetPasswordEmailCode.submitPassword({
        password: resetPasswordNewPassword,
      });

      if (submitPasswordError) {
        setErrorMessage(getClerkErrorMessage(submitPasswordError, t("generic")));
        return;
      }

      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({
          navigate: async () => {
            onSuccess?.();
          },
        });

        if (finalizeError) {
          setErrorMessage(getClerkErrorMessage(finalizeError, t("generic")));
          return;
        }

        return;
      }

      if (signIn.status === "needs_second_factor") {
        setErrorMessage(t("resetPasswordSecondFactor"));
        return;
      }

      setErrorMessage(t("resetPasswordNotComplete"));
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("generic")));
    } finally {
      setIsPending(false);
    }
  };

  const updateResetPasswordCode = (value: string) => {
    setResetPasswordCode(value);
    setIsResetPasswordCodeVerified(false);
  };

  return {
    email,
    password,
    showPassword,
    isPending,
    errorMessage,
    resetPasswordStep,
    resetPasswordCode,
    resetPasswordNewPassword,
    resetPasswordConfirmPassword,
    clientTrustCode,
    needsClientTrustVerification,
    setEmail,
    setPassword,
    setIsPending,
    setErrorMessage,
    setResetPasswordCode: updateResetPasswordCode,
    setResetPasswordNewPassword,
    setResetPasswordConfirmPassword,
    setClientTrustCode,
    togglePasswordVisibility,
    startResetPassword,
    resetResetPassword,
    sendResetPasswordCode,
    submitResetPassword,
    submitClientTrustCode,
    submit,
  };
}
