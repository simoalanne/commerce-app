"use client";

import { FloatingAuthControls } from "@/components/auth/FloatingAuthControls";
import { SiteHeader } from "@/components/layout/SiteHeader";

import styles from "@/components/layout/SiteHeader.module.css";

export function AccountHeader() {
  return (
    <SiteHeader
      rightSlot={
        <div className={`${styles.iconButton} ${styles.scrolledIcon}`}>
          <FloatingAuthControls />
        </div>
      }
    />
  );
}
