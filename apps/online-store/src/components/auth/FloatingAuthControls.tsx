"use client";

import { ReceiptText, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthModal } from "@/components/auth/AuthModal";
import { Popover, PopoverClose } from "@/components/Popover";
import { useAuth, useUser } from "@/features/auth/clerk";
import { Link } from "@/i18n/navigation";

import styles from "./FloatingAuthControls.module.css";

type LogInButtonProps = {
  variant?: "storefront" | "landing";
};

export function FloatingAuthControls({ variant = "storefront" }: LogInButtonProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const t = useTranslations("authMenu");

  const triggerClassName = variant === "landing" ? styles.signInButtonLanding : styles.signInButton;
  const iconClassName =
    variant === "landing" ? `${styles.icon} ${styles.iconLanding}` : styles.icon;

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false);

  const candidate =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "";

  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const userInitial = candidate.trim().charAt(0).toUpperCase() || "A";

  return (
    <>
      <div className={styles.container}>
        {isSignedIn && isLoaded ? (
          <Popover
            open={isAccountPopoverOpen}
            onOpenChange={setIsAccountPopoverOpen}
            triggerLabel={t("avatarLabel")}
            contentLabel={t("menuLabel")}
            contentClassName={styles.menu}
            animation="slide"
            align="end"
            content={
              <div className={styles.accountBlock}>
                <div className={styles.accountHeader}>{t("accountHeader")}</div>

                <div className={styles.accountEmail}>{email}</div>

                <div className={styles.actionRow}>
                  <PopoverClose asChild>
                    <Link href="/account/orders" className={styles.actionButton}>
                      <ReceiptText className={styles.ordersIcon} />
                      {t("orders")}
                    </Link>
                  </PopoverClose>
                  <PopoverClose asChild>
                    <Link href="/account/" className={styles.actionButton}>
                      <User className={styles.profileIcon} />
                      {t("profile")}
                    </Link>
                  </PopoverClose>
                </div>
              </div>
            }
          >
            <button type="button" className={`${triggerClassName} ${styles.loggedInAvatar}`}>
              <span className={styles.avatarInitial}>{userInitial}</span>
            </button>
          </Popover>
        ) : (
          <button
            type="button"
            className={triggerClassName}
            onClick={() => setIsAuthModalOpen(true)}
            aria-label={t("signInLabel")}
          >
            <User className={iconClassName} />
          </button>
        )}
      </div>

      {!isSignedIn && <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />}
    </>
  );
}
