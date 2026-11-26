export type AuthMode = "sign-in" | "sign-up";

export type AuthBaseViewProps = {
  isPending: boolean;
  errorMessage: string | null;
  setIsPending?: (value: boolean) => void;
  setErrorMessage?: (value: string | null) => void;
  onAppleAuth?: () => void;
};

export type SignInViewProps = AuthBaseViewProps & {
  email: string;
  password: string;
  showPassword: boolean;
  setIsPending: (value: boolean) => void;
  setErrorMessage: (value: string | null) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
  onSwitchMode: () => void;
};

export type ResetPasswordRequestViewProps = AuthBaseViewProps & {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onSwitchMode: () => void;
};

export type ResetPasswordVerificationViewProps = AuthBaseViewProps & {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
  showPassword: boolean;
  onCodeChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: () => void;
  onSwitchMode: () => void;
};

export type ClientTrustVerificationViewProps = AuthBaseViewProps & {
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
  onSwitchMode: () => void;
};

export type SignUpViewProps = AuthBaseViewProps & {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  showPassword: boolean;
  setIsPending: (value: boolean) => void;
  setErrorMessage: (value: string | null) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: () => void;
  onSwitchMode: () => void;
};

export type SignUpVerificationViewProps = AuthBaseViewProps & {
  email: string;
  verificationCode: string;
  onVerificationCodeChange: (value: string) => void;
  onSubmit: () => void;
  onSwitchMode: () => void;
};
