import { Link } from "@/i18n/navigation";

import { CheckoutSummarySavedCartAction } from "./CheckoutSummarySavedCartAction";
import { FreeDeliveryProgressBar } from "./FreeDeliveryProgressBar";

import styles from "./CheckoutPage.module.css";

type CheckoutSummaryProps = {
  estimatedSubtotalLabel: string;
  note: string;
  continueLabel: string;
  deliveryFeeStartsFromLabel: string;
  subtotal: number;
  formattedSubtotal: string;
  formattedDeliveryFeeStart: string | null;
  freeDeliveryThreshold: number | null;
  checkoutHref: string;
};

export function CheckoutSummary({
  estimatedSubtotalLabel,
  note,
  continueLabel,
  deliveryFeeStartsFromLabel,
  subtotal,
  formattedSubtotal,
  formattedDeliveryFeeStart,
  freeDeliveryThreshold,
  checkoutHref,
}: CheckoutSummaryProps) {
  return (
    <aside className={styles.summaryPanel}>
      <div className={styles.summaryIntro}>
        <p className={styles.summaryEyebrow}>{estimatedSubtotalLabel}</p>
        <p className={styles.summaryAmount}>{formattedSubtotal}</p>
      </div>

      <p className={styles.summaryNote}>{note}</p>

      <div className={styles.summaryMeta}>
        {formattedDeliveryFeeStart ? (
          <div className={styles.summaryMetaRow}>
            <span className={styles.summaryMetaLabel}>{deliveryFeeStartsFromLabel}</span>
            <span className={styles.summaryMetaValue}>{formattedDeliveryFeeStart}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.freeDeliveryProgressBar}>
        <FreeDeliveryProgressBar subtotal={subtotal} threshold={freeDeliveryThreshold} />
      </div>

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
