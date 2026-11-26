"use client";

import { useTranslations } from "next-intl";

import SideMenuLinks from "../buttons/SideMenuLinks";
import Logo from "./Logo";

import styles from "./SideMenu.module.css";

export interface SideMenuProps {
  onNavigate?: () => void;
  variant?: "sidebar" | "rail";
}

export default function SideMenu({ onNavigate, variant = "sidebar" }: SideMenuProps) {
  const t = useTranslations();

  return (
    <div
      className={
        variant === "rail"
          ? `${styles.sideMenuContainer} ${styles.sideMenuRail}`
          : styles.sideMenuContainer
      }
    >
      <div className={styles.logoContainer}>
        <Logo variant="header" color="dark" arialabel={t("header.arialabels.toLandingPage")} />
      </div>

      <div className={styles.menuLinksContainer}>
        <SideMenuLinks
          className={styles.links}
          linkClassName={styles.categoryItem}
          onClick={onNavigate}
        />
      </div>
    </div>
  );
}
