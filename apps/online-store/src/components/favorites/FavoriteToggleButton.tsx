"use client";

import { Heart, Trash2 } from "lucide-react";
import type React from "react";

import styles from "./FavoriteProductButton.module.css";

type FavoriteToggleButtonProps = {
  mode?: "toggle" | "remove";
  variant?: "overlay" | "inline";
  className?: string;
  isActive: boolean;
  isPending?: boolean;
  ariaLabel: string;
  inlineLabel?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function FavoriteToggleButton({
  mode = "toggle",
  variant = "overlay",
  className,
  isActive,
  isPending = false,
  ariaLabel,
  inlineLabel,
  onClick,
}: FavoriteToggleButtonProps) {
  const isRemoveButton = mode === "remove";

  return (
    <button
      type="button"
      className={joinClassNames(
        styles.button,
        variant === "overlay" ? styles.overlay : styles.inline,
        isRemoveButton ? styles.remove : isActive ? styles.active : styles.inactive,
        className,
      )}
      aria-label={ariaLabel}
      aria-pressed={isRemoveButton ? undefined : isActive}
      disabled={isPending}
      onClick={onClick}
    >
      {isRemoveButton ? (
        <Trash2 className={styles.icon} aria-hidden="true" />
      ) : (
        <>
          <Heart
            className={joinClassNames(styles.icon, isActive && styles.iconFilled)}
            aria-hidden="true"
          />
          {variant === "inline" && inlineLabel ? (
            <span className={styles.label}>{inlineLabel}</span>
          ) : null}
        </>
      )}
    </button>
  );
}
