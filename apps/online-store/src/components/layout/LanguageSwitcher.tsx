"use client";

import { useLocale } from "next-intl";
import { Fragment } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

import styles from "./Footer.module.css";

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const currentLocale = useLocale();

  if (routing.locales.length < 2) return null;

  return (
    <div className={styles.languageSwitcher}>
      {routing.locales.map((locale, index) => (
        <Fragment key={locale}>
          {index > 0 ? <span className={styles.langDivider}>|</span> : null}
          <Link
            prefetch={false}
            href={pathname}
            locale={locale}
            className={currentLocale === locale ? styles.activeLang : styles.langLink}
          >
            {locale.toUpperCase()}
          </Link>
        </Fragment>
      ))}
    </div>
  );
}
