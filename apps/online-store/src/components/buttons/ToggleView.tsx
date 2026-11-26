"use client";

import { Grid2X2, Grid3x3 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import styles from "../productPage/allProductsClient.module.css";

type View = "grid" | "list";

type Props = {
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  ariaLabels?: { grid?: string; list?: string };
};

export default function ViewToggle({ view, setView, ariaLabels }: Props) {
  return (
    <div className={styles.viewToggle}>
      <button
        type="button"
        className={view === "grid" ? styles.viewToggleButtonActive : styles.viewToggleButton}
        onClick={() => setView("grid")}
        aria-pressed={view === "grid"}
        aria-label={ariaLabels?.grid ?? "Grid view"}
      >
        <Grid2X2 />
      </button>

      <button
        type="button"
        className={view === "list" ? styles.viewToggleButtonActive : styles.viewToggleButton}
        onClick={() => setView("list")}
        aria-pressed={view === "list"}
        aria-label={ariaLabels?.list ?? "List view"}
      >
        <Grid3x3 />
      </button>
    </div>
  );
}
