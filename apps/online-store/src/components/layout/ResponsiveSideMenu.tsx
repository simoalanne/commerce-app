"use client";

import { useState } from "react";

import FilterMenu, { type FilterMenuProps } from "./FilterMenu";

import styles from "./ResponsiveSideMenu.module.css";

export default function ResponsiveSideMenu(props: FilterMenuProps) {
  const [isMenuOpen] = useState(true);

  return (
    <aside className={`${styles.desktopAside} ${isMenuOpen ? styles.open : styles.closed}`}>
      <div className={styles.desktopStickyWrap}>
        <div
          className={`${styles.desktopPanel} ${isMenuOpen ? styles.panelOpen : styles.panelClosed}`}
        >
          <FilterMenu {...props} variant="rail" />
        </div>
      </div>
    </aside>
  );
}
