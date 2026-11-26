"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";

import styles from "./Collapsible.module.css";

type CollapsibleProps = {
  title?: ReactNode;
  icon?: ReactNode;
  chevronIcon?: ReactNode;
  defaultOpen?: boolean;
  children?: ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
};

export default function Collapsible({
  title,
  icon,
  chevronIcon,
  defaultOpen = false,
  children,
  className,
  titleClassName,
  contentClassName,
}: CollapsibleProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <div className={[styles.wrapper, className ?? ""].join(" ")}>
      <button
        type="button"
        aria-expanded={open}
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.leftSide}>
          {icon ? <span className={styles.icon}>{icon}</span> : null}
          <span className={[styles.title, titleClassName ?? ""].join(" ")}>{title}</span>
        </span>

        <span className={[styles.chevron, open ? styles.open : ""].join(" ")}>
          {chevronIcon ?? <ChevronDown size={18} />}
        </span>
      </button>

      <section
        className={[styles.content, open ? styles.contentOpen : "", contentClassName ?? ""].join(
          " ",
        )}
      >
        <div className={styles.contentInner}>{children}</div>
      </section>
    </div>
  );
}
