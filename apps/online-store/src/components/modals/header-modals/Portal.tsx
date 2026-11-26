"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./Portal.module.css";

export default function Portal({
  onClose,
  children,
}: {
  onClose?: () => void;
  children?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={styles.overlayBG}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close"
        onClick={() => onClose?.()}
      />
      <div className={styles.overlaySheet}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => onClose?.()}
          aria-label="Close"
        >
          ✕
        </button>

        <div className={styles.overlayBody}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
