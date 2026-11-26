import { Link } from "@/i18n/navigation";

import { CheckoutSummarySavedCartAction } from "./CheckoutSummarySavedCartAction";

import styles from "./CheckoutPage.module.css";

type CheckoutSummaryProps = {
  estimatedSubtotalLabel: string;
  note: string;
  continueLabel: string;
  formattedSubtotal: string;
  checkoutHref: string;
};

export function CheckoutSummary({
  estimatedSubtotalLabel,
  note,
  continueLabel,
  formattedSubtotal,
  checkoutHref,
}: CheckoutSummaryProps) {
  return (
    <aside className={styles.summaryPanel}>
      <div className={styles.summaryIntro}>
        <p className={styles.summaryEyebrow}>{estimatedSubtotalLabel}</p>
        <p className={styles.summaryAmount}>{formattedSubtotal}</p>
      </div>

      <p className={styles.summaryNote}>{note}</p>

      <div className={styles.summaryActions}>
        <Link
          href={checkoutHref}
          className={`${styles.primaryButton} ${styles.summaryPrimaryButton}`}
        >
          <span>{continueLabel}</span>
        </Link>

        <CheckoutSummarySavedCartAction />
      </div>
    </aside>
  );
}
