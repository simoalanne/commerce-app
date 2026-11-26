"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import Logo from "@/components/layout/Logo";
import { Modal, ModalCloseButton } from "@/components/Modal";

import styles from "./AuthModalShell.module.css";

type AuthModalShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function AuthModalShell({ open, onOpenChange, children }: AuthModalShellProps) {
  const t = useTranslations("authModal.shell");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("modalTitle")}
      hideHeader
      contentClassName={styles.modalContent}
      trailingAction={<ModalCloseButton onClick={() => onOpenChange(false)} />}
    >
      <div className={styles.layout}>
        <section className={styles.visualPane} aria-hidden="true">
          <div className={styles.visualContent}>
            <div>
              <Logo variant="header" color="white" arialabel="acme-logo" />
            </div>
            <div>
              <h2 className={styles.heroTitle}>{t("heroTitle")}</h2>
            </div>
            <p className={styles.heroCard}>{t("heroCard")}</p>
          </div>
        </section>
        <section className={styles.formPane}>
          <div className={styles.formHeader}>
            <ModalCloseButton onClick={() => onOpenChange(false)} />
          </div>
          {children}
        </section>
      </div>
    </Modal>
  );
}
