"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Modal } from "@/components/Modal";
import { LegalDocumentContent } from "@/features/legal-documents/LegalDocumentContent";

import styles from "./CheckoutTermsAcceptance.module.css";

export type CheckoutTermsDocument = {
  title: string;
  content: string;
  updatedAt: string;
};

type CheckoutTermsAcceptanceProps = {
  document: CheckoutTermsDocument;
  submitLabel: string;
};

function formatDate(date: string) {
  return date.slice(0, 10);
}

export function CheckoutTermsAcceptance({ document, submitLabel }: CheckoutTermsAcceptanceProps) {
  const t = useTranslations("checkout.form.termsAcceptance");
  const tLegalDocument = useTranslations("legalDocument");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <p className={styles.notice}>
        {t.rich("notice", {
          submitLabel,
          terms: (chunks) => (
            <button type="button" className={styles.linkButton} onClick={() => setIsOpen(true)}>
              {chunks}
            </button>
          ),
        })}
      </p>

      <Modal
        open={isOpen}
        onOpenChange={setIsOpen}
        title={document.title}
        contentClassName={styles.modalContent}
      >
        <LegalDocumentContent
          content={document.content}
          lastUpdatedLabel={tLegalDocument("lastUpdated", {
            date: formatDate(document.updatedAt),
          })}
        />
      </Modal>
    </>
  );
}
