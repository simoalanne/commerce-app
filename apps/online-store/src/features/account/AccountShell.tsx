"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth, useUser } from "@/features/auth/clerk";

import { AccountNav } from "./AccountNav";

import styles from "./AccountShell.module.css";

type AccountShellProps = {
  children: ReactNode;
};

export function AccountShell({ children }: AccountShellProps) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded, user } = useUser();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const displayName = user?.fullName ?? user?.firstName ?? "Member";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const t = useTranslations("accountPage");

  if (!authLoaded) return;

  return (
    <main className={styles.shell}>
      {!isSignedIn ? (
        <section className={styles.guestCard}>
          <p className={styles.guestEyebrow}>{t("account")}</p>
          <h1 className={styles.guestTitle}>{t("signInToView")}</h1>
          <p className={styles.guestText}>{t("authenticatedContent")}</p>
          <button
            className={styles.signInButton}
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
          >
            Sign in
          </button>
          <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />
        </section>
      ) : (
        <>
          <div className={styles.mobileNav}>
            <AccountNav />
          </div>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>{t("account")}</p>
            <h1 className={styles.title}>
              {isLoaded ? t("welcomeBack", { firstName: displayName }) : "Welcome back."}
            </h1>
            {email ? <p className={styles.subtitle}>{email}</p> : null}
          </header>

          <div className={styles.layout}>
            <aside className={styles.sidebar}>
              <AccountNav />
            </aside>
            <section className={styles.content}>{children}</section>
          </div>
        </>
      )}
    </main>
  );
}
