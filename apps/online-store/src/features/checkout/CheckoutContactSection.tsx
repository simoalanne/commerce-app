"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AuthModal } from "@/components/auth/AuthModal";
import { TextField } from "@/components/forms/TextField";
import { Popover, PopoverClose } from "@/components/Popover";
import { useClerk, useUser } from "@/features/auth/clerk";

import type { CheckoutFormState } from "./checkoutTypes";
import FormSection from "./FormSection";

import styles from "./CheckoutContactSection.module.css";

type ContactState = Pick<CheckoutFormState, "email" | "phone" | "firstName" | "lastName">;

type CheckoutContactSectionProps = {
  state: ContactState;
  setState: (updater: (current: ContactState) => ContactState) => void;
  emailError?: string | null;
  phoneError?: string | null;
  firstNameError?: string | null;
  lastNameError?: string | null;
  onPhoneBlur?: () => void;
};

export function CheckoutContactSection({
  state,
  setState,
  emailError,
  phoneError,
  firstNameError,
  lastNameError,
  onPhoneBlur,
}: CheckoutContactSectionProps) {
  const t = useTranslations("checkout");
  const { signOut } = useClerk();
  const { isLoaded, user } = useUser();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const isSignedIn = isLoaded && !!user;
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const avatarLabel = (user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "G")
    .slice(0, 1)
    .toUpperCase();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setState((current) => ({
      ...current,
      email: current.email || email,
      firstName: current.firstName || firstName,
      lastName: current.lastName || lastName,
    }));
  }, [isSignedIn]);

  const handleSignOut = async () => {
    await signOut({
      redirectUrl: window.location.href,
    });
  };

  return (
    <FormSection title={t("form.contact.title")}>
      <div className={styles.section}>
        <div className={styles.statusShell}>
          <div className={styles.statusBlock}>
            <div className={styles.statusRow}>
              {isSignedIn ? (
                <>
                  <div className={styles.statusIdentity}>
                    <span className={styles.avatar} aria-hidden="true">
                      {avatarLabel}
                    </span>
                    <span className={styles.email}>{email}</span>
                  </div>
                  <Popover
                    triggerLabel={t("form.contact.accountMenu")}
                    contentLabel={t("form.contact.accountMenu")}
                    contentClassName={styles.menu}
                    align="end"
                    sideOffset={6}
                    content={
                      <PopoverClose asChild>
                        <button
                          type="button"
                          className={styles.menuAction}
                          onClick={() => void handleSignOut()}
                        >
                          {t("form.contact.signOut")}
                        </button>
                      </PopoverClose>
                    }
                  >
                    <button type="button" className={styles.menuButton}>
                      ⋯
                    </button>
                  </Popover>
                </>
              ) : (
                <>
                  <div className={styles.statusIdentity}>
                    <span className={styles.guestLabel}>{t("form.contact.guestOrder")}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.statusAction}
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    {t("form.contact.signIn")}
                  </button>
                </>
              )}
            </div>
            {!isSignedIn && <p className={styles.helperText}>{t("form.contact.signInHint")}</p>}
          </div>
        </div>

        <div className={styles.fieldGrid}>
          <div className={styles.fieldGridFull}>
            <TextField
              id="checkout-email"
              name="email"
              label={t("form.contact.email")}
              value={state.email}
              validationState={emailError ? "error" : "default"}
              helperText={emailError ?? undefined}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              type="email"
              autoComplete="email"
            />
          </div>
          <div className={styles.fieldGridFull}>
            <TextField
              id="checkout-phone"
              name="phone"
              label={t("form.contact.phone")}
              tooltipText={t("form.contact.phoneTooltipBody")}
              tooltipAriaTriggerLabel={t("form.contact.phoneTooltipTrigger")}
              value={state.phone}
              validationState={phoneError ? "error" : "default"}
              helperText={phoneError ?? undefined}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              onBlur={onPhoneBlur}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
            />
          </div>
          <TextField
            id="checkout-first-name"
            name="given-name"
            label={t("form.contact.firstName")}
            value={state.firstName}
            validationState={firstNameError ? "error" : "default"}
            helperText={firstNameError ?? undefined}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                firstName: event.target.value,
              }))
            }
            autoComplete="given-name"
          />
          <TextField
            id="checkout-last-name"
            name="family-name"
            label={t("form.contact.lastName")}
            value={state.lastName}
            validationState={lastNameError ? "error" : "default"}
            helperText={lastNameError ?? undefined}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                lastName: event.target.value,
              }))
            }
            autoComplete="family-name"
          />
        </div>
      </div>

      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />
    </FormSection>
  );
}
