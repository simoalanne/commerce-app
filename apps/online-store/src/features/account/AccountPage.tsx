"use client";

import { downloadBlob } from "@acme/shared";
import { isDefinedError } from "@rest-rpc/core";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

import { AsyncBoundary } from "@/components/async-boundary";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { TextField } from "@/components/forms/TextField";
import { Modal } from "@/components/Modal";
import { useClerk, useUser } from "@/features/auth/clerk";
import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useApiClient } from "@/providers/ApiClientProvider";
import { getClerkErrorMessage } from "@/utils/getClerkErrorMessage";
import { splitFullName } from "@/utils/splitFullName";

import styles from "./AccountPage.module.css";

export default function AccountPage() {
  return (
    <AsyncBoundary>
      <AccountPageContent />
    </AsyncBoundary>
  );
}

function AccountPageContent() {
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const { queryUtils } = useApiClient();
  const { signOut } = useClerk();
  const { isLoaded, user } = useUser();
  const t = useTranslations("accountPage");
  const setInitialPassword = useMutation(
    queryUtils.user.account.setInitialPassword.mutationOptions(),
  );
  const { data: preferences } = useSuspenseQuery(
    queryUtils.user.account.getPreferences.queryOptions({
      select: (r) => r.body,
    }),
  );
  const setPreferences = useMutation(queryUtils.user.account.setPreferences.mutationOptions());
  const deleteAccount = useMutation(
    queryUtils.user.account.delete.mutationOptions({
      onSuccess: async () => {
        await signOut({ redirectUrl: `/${params.locale}` });
        router.replace("/");
      },
    }),
  );
  const [fullName, setFullName] = useState("");
  const [preferredLocale, setPreferredLocale] = useState(preferences.preferredLocale);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isDownloadingExport, setIsDownloadingExport] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showNewPasswordConfirmation, setShowNewPasswordConfirmation] = useState<boolean>(false);

  const handleChangePassword = () =>
    user?.updatePassword({
      currentPassword,
      newPassword,
    });

  const deleteError =
    isDefinedError(deleteAccount.error) &&
    deleteAccount.error.code === "ACCOUNT_DELETION_BLOCKED_BY_PAID_ORDERS"
      ? t("delete.errors.paidOrders")
      : deleteAccount.error
        ? t("delete.errors.generic")
        : null;

  const handleDeleteAccount = () => {
    setIsDeleteModalOpen(false);
    deleteAccount.mutate();
  };

  const deleteMessage = deleteAccount.isSuccess ? t("delete.success") : null;

  useEffect(() => {
    setFullName(user?.fullName ?? "");
  }, [user?.fullName]);

  if (!isLoaded || !user) {
    return <section className={styles.page} />;
  }

  const email = user.primaryEmailAddress?.emailAddress ?? t("profile.noEmailAddress");
  const phone = user.primaryPhoneNumber?.phoneNumber ?? t("profile.noPhoneNumber");

  const handleProfileSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    const parsedName = splitFullName(fullName);
    if (!parsedName.firstName) {
      setProfileError(t("profile.errors.fullNameRequired"));
      return;
    }

    setIsSavingProfile(true);
    try {
      await Promise.all([
        user.update(parsedName),
        setPreferences.mutateAsync({ body: { preferredLocale } }),
      ]);
      setProfileMessage(t("profile.success"));
    } catch (error) {
      setProfileError(getClerkErrorMessage(error, t("profile.errors.generic")));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!newPassword) {
      setPasswordError(t("password.errors.newPasswordRequired"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("password.errors.passwordsDoNotMatch"));
      return;
    }

    if (user.passwordEnabled && !currentPassword) {
      setPasswordError(t("password.errors.currentPasswordRequired"));
      return;
    }

    setIsSavingPassword(true);
    try {
      if (user.passwordEnabled) {
        await handleChangePassword();
      } else {
        await setInitialPassword.mutateAsync({
          body: { password: newPassword },
        });
        await user.reload();
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        user.passwordEnabled ? t("password.successUpdated") : t("password.successCreated"),
      );
    } catch (error) {
      setPasswordError(getClerkErrorMessage(error, t("password.errors.generic")));
    } finally {
      setIsSavingPassword(false);
    }
  };

  // TODO: long term backend should not just return json file directly. instead a typical
  // approach is that queryUtils does a data request then backend prepares the data and sends an email containing either
  // a link or a file attachment
  const handleDownloadExport = async () => {
    setExportMessage(null);
    setExportError(null);
    setIsDownloadingExport(true);

    try {
      const { body } = await queryUtils.user.exportData.fetch();
      // Clerk ids are "user_<id>"; the filename keeps the bare id.
      const userId = user.id.slice(5);
      const timestamp = new Date().toISOString().slice(0, 10);

      downloadBlob(
        new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }),
        `customer_${userId}_data_${timestamp}.json`,
      );

      setExportMessage(t("export.success"));
    } catch {
      setExportError(t("export.error"));
    } finally {
      setIsDownloadingExport(false);
    }
  };

  return (
    <section className={styles.page}>
      <Modal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title={t("delete.title")}
        subtitle={t("delete.confirmation")}
      >
        <p className={styles.mutedText}>{t("delete.warning")}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setIsDeleteModalOpen(false)}
          >
            {t("delete.cancelAction")}
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            disabled={deleteAccount.isPending}
            onClick={handleDeleteAccount}
          >
            {deleteAccount.isPending ? t("delete.deleting") : t("delete.confirmAction")}
          </button>
        </div>
      </Modal>

      {/* <div className={styles.intro}>
        <h2 className={styles.title}>{t("intro.title")}</h2>
      </div> */}

      <div className={styles.cardGrid}>
        <div className={styles.column}>
          <form className={styles.card} onSubmit={handleProfileSubmit}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{t("profile.title")}</h3>
                <p className={styles.cardText}>{t("profile.description")}</p>
              </div>
            </div>

            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t("profile.emailLabel")}</span>
                <span className={styles.infoValue}>{email}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t("profile.phoneLabel")}</span>
                <span className={styles.infoValue}>{phone}</span>
              </div>
            </div>

            <TextField
              id="account-full-name"
              label={t("profile.fullNameLabel")}
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
            />

            <NativeSelect
              label={t("profile.preferredLanguageLabel")}
              value={preferredLocale}
              onChange={setPreferredLocale}
              options={routing.locales.map((locale) => ({
                label: new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale,
                value: locale,
              }))}
            />

            {profileError ? <p className={styles.error}>{profileError}</p> : null}
            {profileMessage ? <p className={styles.success}>{profileMessage}</p> : null}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={isSavingProfile}>
                {isSavingProfile ? t("actions.saving") : t("actions.saveProfile")}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.column}>
          <form className={styles.card} onSubmit={handlePasswordSubmit}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  {user.passwordEnabled ? t("password.titleUpdate") : t("password.titleCreate")}
                </h3>
                <p className={styles.cardText}>
                  {user.passwordEnabled
                    ? t("password.descriptionUpdate")
                    : t("password.descriptionCreate")}
                </p>
              </div>
            </div>

            {user.passwordEnabled ? (
              <TextField
                id="account-current-password"
                label={t("password.currentPasswordLabel")}
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                trailingElement={
                  <button
                    type="button"
                    className={styles.passwordTextFieldToggle}
                    aria-label={
                      showCurrentPassword ? t("password.hidePassword") : t("password.showPassword")
                    }
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    disabled={isSavingPassword}
                  >
                    {showCurrentPassword ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                }
              />
            ) : null}

            <TextField
              id="account-new-password"
              label={t("password.newPasswordLabel")}
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              trailingElement={
                <button
                  type="button"
                  className={styles.passwordTextFieldToggle}
                  aria-label={
                    showNewPassword ? t("password.hidePassword") : t("password.showPassword")
                  }
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  disabled={isSavingPassword}
                >
                  {showNewPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              }
            />

            <TextField
              id="account-confirm-password"
              label={t("password.confirmPasswordLabel")}
              type={showNewPasswordConfirmation ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              trailingElement={
                <button
                  type="button"
                  className={styles.passwordTextFieldToggle}
                  aria-label={showNewPasswordConfirmation ? "hidePassword" : "showPassword"}
                  onClick={() => setShowNewPasswordConfirmation((prev) => !prev)}
                  disabled={isSavingPassword}
                >
                  {showNewPasswordConfirmation ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              }
            />

            {passwordError ? <p className={styles.error}>{passwordError}</p> : null}
            {passwordMessage ? <p className={styles.success}>{passwordMessage}</p> : null}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={isSavingPassword}>
                {isSavingPassword
                  ? t("actions.saving")
                  : user.passwordEnabled
                    ? t("actions.updatePassword")
                    : t("actions.setPassword")}
              </button>
            </div>
          </form>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{t("export.title")}</h3>
                <p className={styles.cardText}>{t("export.description")}</p>
              </div>
            </div>
            {exportError ? <p className={styles.error}>{exportError}</p> : null}
            {exportMessage ? <p className={styles.success}>{exportMessage}</p> : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isDownloadingExport}
                onClick={() => void handleDownloadExport()}
              >
                {isDownloadingExport ? t("export.downloading") : t("export.action")}
              </button>
            </div>
          </section>
        </div>

        <section className={`${styles.card} ${styles.dangerCard} ${styles.fullWidthCard}`}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>{t("delete.title")}</h3>
              <p className={styles.cardText}>{t("delete.description")}</p>
            </div>
          </div>
          <p className={styles.mutedText}>{t("delete.warning")}</p>
          {deleteError ? <p className={styles.error}>{deleteError}</p> : null}
          {deleteMessage ? <p className={styles.success}>{deleteMessage}</p> : null}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={deleteAccount.isPending}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              {deleteAccount.isPending ? t("delete.deleting") : t("delete.action")}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
