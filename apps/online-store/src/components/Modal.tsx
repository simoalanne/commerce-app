"use client";

import { ArrowLeft, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, VisuallyHidden } from "radix-ui";
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
} from "react";

import styles from "./Modal.module.css";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  overlayContent?: ReactNode;
  subtitle?: string;
  dismissible?: boolean;
  leadingAction?: ReactNode;
  trailingAction?: ReactNode;
  hideHeader?: boolean;
  contentClassName?: string;
};

type ModalIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
};

function handleInteractOutside(event: Event, dismissible: boolean) {
  if (!dismissible) {
    event.preventDefault();
  }
}

function handleWrapperPointerDown(
  event: ReactPointerEvent<HTMLDivElement>,
  dismissible: boolean,
  onOpenChange: (open: boolean) => void,
) {
  if (!dismissible) {
    return;
  }

  if (event.target === event.currentTarget) {
    onOpenChange(false);
  }
}

// TODO: this is very likely doing things harder than they need to be. Animating fade in/out
// while preserving scroll lock is apparently very hard hence why this mess exists.
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  overlayContent,
  subtitle,
  dismissible = true,
  leadingAction,
  trailingAction,
  hideHeader = false,
  contentClassName,
}: ModalProps) {
  const contentClassNames = [styles.content, contentClassName].filter(Boolean).join(" ");

  const resolvedTrailingAction =
    trailingAction ??
    (dismissible ? <ModalCloseButton onClick={() => onOpenChange(false)} /> : null);

  useEffect(() => {
    document.documentElement.style.scrollbarWidth = open ? "none" : "";
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.contentPositioner}
          onPointerDown={(event) => handleWrapperPointerDown(event, dismissible, onOpenChange)}
          onEscapeKeyDown={(event) => handleInteractOutside(event, dismissible)}
        >
          {overlayContent}
          <div className={contentClassNames}>
            {hideHeader ? (
              <>
                <VisuallyHidden.Root asChild>
                  <Dialog.Title>{title}</Dialog.Title>
                </VisuallyHidden.Root>
                <VisuallyHidden.Root asChild>
                  <Dialog.Description>{subtitle ?? title}</Dialog.Description>
                </VisuallyHidden.Root>
              </>
            ) : (
              <header className={styles.header}>
                {leadingAction ? leadingAction : <div aria-hidden="true" />}
                <div className={styles.headerMain}>
                  <div className={styles.titleRow}>
                    <Dialog.Title className={styles.title}>{title}</Dialog.Title>
                  </div>
                  {subtitle ? (
                    <Dialog.Description className={styles.subtitle}>{subtitle}</Dialog.Description>
                  ) : (
                    <VisuallyHidden.Root asChild>
                      <Dialog.Description>{title}</Dialog.Description>
                    </VisuallyHidden.Root>
                  )}
                </div>
                {resolvedTrailingAction ? resolvedTrailingAction : null}
              </header>
            )}

            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalIconButton({
  label,
  icon,
  type = "button",
  className,
  ...props
}: ModalIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={className ? `${styles.cornerAction} ${className}` : styles.cornerAction}
      {...props}
    >
      {icon}
    </button>
  );
}

export function ModalCloseButton(props: Omit<ModalIconButtonProps, "label" | "icon">) {
  const t = useTranslations("modal");

  return (
    <ModalIconButton label={t("close")} icon={<X size={18} aria-hidden="true" />} {...props} />
  );
}

export function ModalBackButton(props: Omit<ModalIconButtonProps, "label" | "icon">) {
  const t = useTranslations("modal");

  return (
    <ModalIconButton
      label={t("back")}
      icon={<ArrowLeft size={18} aria-hidden="true" />}
      {...props}
    />
  );
}
