import { useAuth, useClerk } from "@clerk/react";
import { useSignIn as useLegacySignIn } from "@clerk/react/legacy";
import { type SubmitEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryUtils, useDashboardSession } from "@/context/ApiClientContext";

const genericLoginError = "Invalid credentials";

export default function Login() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn, setActive } = useLegacySignIn();
  const { signOut } = useClerk();
  const { dashboardSession, isSessionResolved } = useDashboardSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [needsClientTrustVerification, setNeedsClientTrustVerification] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeLogin = async (sessionId: string) => {
    await setActive?.({ session: sessionId });
    const { body: session } = await queryUtils.auth.getSession.fetch();

    if (session.role !== "ADMIN") {
      await signOut();
      setErrorMessage(genericLoginError);
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !signIn || !setActive || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setVerificationCode("");
    setNeedsClientTrustVerification(false);

    try {
      if (isSignedIn) {
        await signOut();
      }

      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (attempt.status === "complete" && attempt.createdSessionId) {
        await completeLogin(attempt.createdSessionId);
        return;
      }

      const status = attempt.status as string | null;
      if (status === "needs_client_trust") {
        const emailCodeFactor = attempt.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );

        if (emailCodeFactor) {
          await attempt.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });
          setNeedsClientTrustVerification(true);
          return;
        }
      }

      setErrorMessage(genericLoginError);
    } catch {
      if (isSignedIn) {
        await signOut();
      }
      setErrorMessage(genericLoginError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !signIn || !needsClientTrustVerification || isSubmitting) {
      return;
    }

    const code = verificationCode.trim();
    if (!code) {
      setErrorMessage("Verification code is required");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code,
      });

      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        setErrorMessage(genericLoginError);
        return;
      }

      await completeLogin(attempt.createdSessionId);
    } catch {
      if (isSignedIn) {
        await signOut();
      }
      setErrorMessage(genericLoginError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (isSignedIn && isSessionResolved && dashboardSession?.role === "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={needsClientTrustVerification ? handleVerificationSubmit : handleSubmit}
          >
            {needsClientTrustVerification ? (
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </>
            )}
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <Button className="w-full" type="submit" disabled={isSubmitting || !isLoaded}>
              {isSubmitting ? "Signing in..." : needsClientTrustVerification ? "Verify" : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
