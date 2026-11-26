"use client";

import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.css";

type PrimaryButtonProps = {
  label: string;
  isLoading?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export default function Button({
  label,
  isLoading = false,
  className,
  disabled,
  type = "button",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={className ? `${styles.button} ${className}` : styles.button}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
    >
      <span className={styles.label}>{label}</span>
      {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
    </button>
  );
}
