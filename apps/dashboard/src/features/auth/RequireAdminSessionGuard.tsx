import { useAuth, useClerk } from "@clerk/react";
import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useDashboardSession } from "@/context/ApiClientContext";

export default function RequireAdminSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const { dashboardSession, isSessionResolved } = useDashboardSession();
  const [isRejectingUser, setIsRejectingUser] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isSessionResolved || isRejectingUser) return;
    if (dashboardSession?.role === "ADMIN") return;

    setIsRejectingUser(true);
    void (async () => {
      await signOut();
      navigate("/login", {
        replace: true,
        state: { from: location.pathname },
      });
    })();
  }, [
    dashboardSession?.role,
    isLoaded,
    isRejectingUser,
    isSessionResolved,
    isSignedIn,
    location.pathname,
    navigate,
    signOut,
  ]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isSessionResolved || isRejectingUser || dashboardSession?.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
