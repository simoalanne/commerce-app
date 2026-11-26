"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, VisuallyHidden } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";

import styles from "./SideBar.module.css";

type SideBarProps = {
  children: ReactNode;
  footer?: ReactNode;
  side: "left" | "right";
  trigger?: ReactNode;
  triggerLabel?: string;
  title?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Reusable sidebar component that is animated, accessible and handles scroll lock / scroll bar
 * hiding when open.
 * @param children The content of the sidebar
 * @param footer Optional footer content that is fixed to the bottom of the sidebar
 * @param side Which side the sidebar should open from, either "left" or "right"
 * @param trigger The element that triggers the sidebar to open when clicked
 * @param triggerLabel Aria-label for the trigger element, for accessibility
 * @param title Optional title for the sidebar, used for accessibility
 * @param open Optional controlled open state for the sidebar. If not provided, the sidebar will manage its own open state.
 * @param onOpenChange Optional callback that is called when the open state changes, with the new open state as an argument.
 *        Only used if `open` prop is provided.
 */
export default function SideBar({
  children,
  footer,
  side,
  trigger,
  triggerLabel,
  title = "Sidebar",
  open: controlledOpen,
  onOpenChange,
}: SideBarProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const t = useTranslations("sideBar");
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const contentClassName =
    side === "left" ? `${styles.content} ${styles.left}` : `${styles.content} ${styles.right}`;

  useEffect(() => {
    document.documentElement.style.scrollbarWidth = open ? "none" : "";
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {trigger && (
        <Dialog.Trigger asChild>
          <button type="button" aria-label={triggerLabel} className={styles.trigger}>
            {trigger}
          </button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={contentClassName}>
          <div className={styles.panel}>
            <VisuallyHidden.Root asChild>
              <Dialog.Title>{title}</Dialog.Title>
            </VisuallyHidden.Root>
            <VisuallyHidden.Root asChild>
              <Dialog.Description>{title}</Dialog.Description>
            </VisuallyHidden.Root>
            <div className={styles.header}>
              <Dialog.Close asChild>
                <button type="button" aria-label={t("close")} className={styles.closeButton}>
                  <X size={18} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <div className={styles.body}>{children}</div>
            {footer ? <div className={styles.footer}>{footer}</div> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
