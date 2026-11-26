"use client";

import { useTranslations } from "next-intl";

import ScrollHeader from "@/app/[locale]/HeaderScrollShell";
import { Link } from "@/i18n/navigation";

import styles from "./not-found.module.css";

type ErrorPageProps = {
  unstable_retry: () => void;
};

export default function ErrorPage({ unstable_retry }: ErrorPageProps) {
  const t = useTranslations("serverError");

  return (
    <>
      <ScrollHeader alwaysScrolled animated />
      <main className={styles.main}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={unstable_retry}>
            {t("tryAgain")}
          </button>
          <Link href="/" className={styles.secondaryButton}>
            {t("homePage")}
          </Link>
        </div>
      </main>
    </>
  );
}
