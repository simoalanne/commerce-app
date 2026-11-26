"use client";

import { useState } from "react";

import { AuthClientTrustVerificationView } from "./AuthClientTrustVerificationView";
import type { AuthMode } from "./AuthModal.types";
import { AuthModalShell } from "./AuthModalShell";
import { AuthResetPasswordRequestView } from "./AuthResetPasswordRequestView";
import { AuthResetPasswordVerificationView } from "./AuthResetPasswordVerificationView";
import { AuthSignInView } from "./AuthSignInView";
import { AuthSignUpVerificationView } from "./AuthSignUpVerificationView";
import { AuthSignUpView } from "./AuthSignUpView";
import { useSignInFlow } from "./hooks/useSignInFlow";
import { useSignUpFlow } from "./hooks/useSignUpFlow";

type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: AuthMode;
};

export function AuthModal({ open, onOpenChange, initialMode = "sign-in" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const signInFlow = useSignInFlow({ onSuccess: () => onOpenChange(false) });
  const signUpFlow = useSignUpFlow({ onSuccess: () => onOpenChange(false) });

  const handleSwitchToSignIn = () => {
    signInFlow.resetResetPassword();
    signUpFlow.resetVerification();
    setMode("sign-in");
  };

  return (
    <AuthModalShell open={open} onOpenChange={onOpenChange}>
      {mode === "sign-in" && signInFlow.resetPasswordStep === "request" ? (
        <AuthResetPasswordRequestView
          email={signInFlow.email}
          isPending={signInFlow.isPending}
          errorMessage={signInFlow.errorMessage}
          onEmailChange={signInFlow.setEmail}
          onSubmit={() => void signInFlow.sendResetPasswordCode()}
          onSwitchMode={handleSwitchToSignIn}
        />
      ) : mode === "sign-in" && signInFlow.resetPasswordStep === "verify" ? (
        <AuthResetPasswordVerificationView
          email={signInFlow.email}
          code={signInFlow.resetPasswordCode}
          newPassword={signInFlow.resetPasswordNewPassword}
          confirmPassword={signInFlow.resetPasswordConfirmPassword}
          showPassword={signInFlow.showPassword}
          isPending={signInFlow.isPending}
          errorMessage={signInFlow.errorMessage}
          onCodeChange={signInFlow.setResetPasswordCode}
          onNewPasswordChange={signInFlow.setResetPasswordNewPassword}
          onConfirmPasswordChange={signInFlow.setResetPasswordConfirmPassword}
          onTogglePasswordVisibility={signInFlow.togglePasswordVisibility}
          onSubmit={() => void signInFlow.submitResetPassword()}
          onSwitchMode={handleSwitchToSignIn}
        />
      ) : mode === "sign-in" && signInFlow.needsClientTrustVerification ? (
        <AuthClientTrustVerificationView
          code={signInFlow.clientTrustCode}
          isPending={signInFlow.isPending}
          errorMessage={signInFlow.errorMessage}
          onCodeChange={signInFlow.setClientTrustCode}
          onSubmit={() => void signInFlow.submitClientTrustCode()}
          onSwitchMode={handleSwitchToSignIn}
        />
      ) : mode === "sign-in" ? (
        <AuthSignInView
          email={signInFlow.email}
          password={signInFlow.password}
          showPassword={signInFlow.showPassword}
          isPending={signInFlow.isPending}
          errorMessage={signInFlow.errorMessage}
          setIsPending={signInFlow.setIsPending}
          setErrorMessage={signInFlow.setErrorMessage}
          onEmailChange={signInFlow.setEmail}
          onPasswordChange={signInFlow.setPassword}
          onTogglePasswordVisibility={signInFlow.togglePasswordVisibility}
          onSubmit={() => void signInFlow.submit()}
          onForgotPassword={signInFlow.startResetPassword}
          onSwitchMode={() => setMode("sign-up")}
        />
      ) : signUpFlow.pendingVerification ? (
        <AuthSignUpVerificationView
          email={signUpFlow.email}
          verificationCode={signUpFlow.verificationCode}
          isPending={signUpFlow.isPending}
          errorMessage={signUpFlow.errorMessage}
          onVerificationCodeChange={signUpFlow.setVerificationCode}
          onSubmit={() => void signUpFlow.verifyEmail()}
          onSwitchMode={handleSwitchToSignIn}
        />
      ) : (
        <AuthSignUpView
          firstName={signUpFlow.firstName}
          lastName={signUpFlow.lastName}
          email={signUpFlow.email}
          password={signUpFlow.password}
          showPassword={signUpFlow.showPassword}
          isPending={signUpFlow.isPending}
          errorMessage={signUpFlow.errorMessage}
          setIsPending={signUpFlow.setIsPending}
          setErrorMessage={signUpFlow.setErrorMessage}
          onFirstNameChange={signUpFlow.setFirstName}
          onLastNameChange={signUpFlow.setLastName}
          onEmailChange={signUpFlow.setEmail}
          onPasswordChange={signUpFlow.setPassword}
          onTogglePasswordVisibility={signUpFlow.togglePasswordVisibility}
          onSubmit={() => void signUpFlow.submit()}
          onSwitchMode={handleSwitchToSignIn}
        />
      )}
    </AuthModalShell>
  );
}
