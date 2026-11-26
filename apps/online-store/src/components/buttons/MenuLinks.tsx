"use client";

import { useTranslations } from "next-intl";
import type React from "react";

import { Link } from "@/i18n/navigation";

import styles from "../layout/SiteHeader.module.css";

interface LinkProps {
  className?: string;
  linkClassName?: string;
  activeLinkClassName?: string;
  animated?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function MenuLinks({
  className,
  linkClassName = "",
  animated = false,
  style,
  onClick,
}: LinkProps) {
  const t = useTranslations();

  const links = [
    {
      href: "/",
      label: t("header.home"),
    },
    {
      href: "/vendors",
      label: t("header.vendors"),
    },
    {
      href: "/products",
      label: t("header.products"),
    },
    {
      href: "/contact",
      label: t("header.contactUs"),
    },
  ];

  return (
    <div className={className} style={style}>
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className={linkClassName} onClick={onClick}>
          {animated ? (
            <span className={styles.linkLabelViewport}>
              <span className={styles.linkLabelTrack}>
                <span className={styles.linkLabelCopy}>{label}</span>
                <span
                  className={`${styles.linkLabelCopy} ${styles.linkLabelSecondary}`.trim()}
                  aria-hidden="true"
                >
                  {label}
                </span>
              </span>
            </span>
          ) : (
            label
          )}
        </Link>
      ))}
    </div>
  );
}
