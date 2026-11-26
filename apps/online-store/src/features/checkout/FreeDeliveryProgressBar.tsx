import { useTranslations } from "next-intl";

import { formatPrice } from "@/utils/formatPrice";

import styles from "./FreeDeliveryProgressBar.module.css";

type FreeDeliveryProgressBarProps = {
  subtotal: number;
  threshold: number | null;
};

export function FreeDeliveryProgressBar({ subtotal, threshold }: FreeDeliveryProgressBarProps) {
  const t = useTranslations("checkout.summary");

  if (!threshold) {
    return null;
  }

  const percentage = Math.min((subtotal / threshold) * 100, 100);
  const remaining = Math.max(threshold - subtotal, 0);
  const qualifies = subtotal >= threshold;

  return (
    <div className={styles.container}>
      <p className={styles.message}>
        {qualifies
          ? t("qualified")
          : t("remaining", {
              remaining: formatPrice(remaining),
            })}
      </p>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
