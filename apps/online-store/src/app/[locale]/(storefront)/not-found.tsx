import { useTranslations } from "next-intl";

import ScrollHeader from "@/app/[locale]/HeaderScrollShell.tsx";
import { Link } from "@/i18n/navigation";

import styles from "./not-found.module.css";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <>
      <ScrollHeader alwaysScrolled animated />
      <main className={styles.main}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
        <Link href="/" className={styles.button}>
          {t("homePage")}
        </Link>
      </main>
    </>
  );
}
