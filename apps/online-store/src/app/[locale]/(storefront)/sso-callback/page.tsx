import { AuthenticateWithRedirectCallback } from "@/features/auth/clerk";

type SsoCallbackPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function SsoCallbackPage({ params }: SsoCallbackPageProps) {
  const { locale } = await params;

  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl={`/${locale}`}
      signUpFallbackRedirectUrl={`/${locale}`}
    />
  );
}
