"use client";

import { Popover as RadixPopover } from "radix-ui";
import {
  type ComponentProps,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import styles from "./Popover.module.css";

export type PopoverSide = "top" | "right" | "bottom" | "left";
export type PopoverAlign = "start" | "center" | "end";
export type PopoverAnimation = "grow" | "slide";

type PopoverProps = {
  children?: ReactElement;
  anchor?: ReactElement;
  content: ReactNode;
  triggerLabel?: string;
  contentLabel?: string;
  contentClassName?: string;
  side?: PopoverSide;
  align?: PopoverAlign;
  sideOffset?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  animation?: PopoverAnimation;
  onOpenAutoFocus?: ComponentProps<typeof RadixPopover.Content>["onOpenAutoFocus"];
  onCloseAutoFocus?: ComponentProps<typeof RadixPopover.Content>["onCloseAutoFocus"];
  onFocusOutside?: ComponentProps<typeof RadixPopover.Content>["onFocusOutside"];
};

export function Popover({
  children,
  anchor,
  content,
  triggerLabel,
  contentLabel,
  contentClassName,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  open,
  onOpenChange,
  animation = "grow",
  onOpenAutoFocus,
  onCloseAutoFocus,
  onFocusOutside,
}: PopoverProps) {
  const contentClassNames = [
    styles.content,
    animation === "slide" ? styles.slide : styles.grow,
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");
  const triggerElement =
    triggerLabel && children
      ? cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
          "aria-label": triggerLabel,
        })
      : children;

  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      {anchor ? <RadixPopover.Anchor asChild>{anchor}</RadixPopover.Anchor> : null}
      {children ? (
        <RadixPopover.Trigger asChild>
          {isValidElement(triggerElement) ? triggerElement : children}
        </RadixPopover.Trigger>
      ) : null}
      <RadixPopover.Portal>
        <RadixPopover.Content
          className={contentClassNames}
          style={{ zIndex: 2147483647 }}
          side={side}
          align={align}
          sideOffset={sideOffset}
          aria-label={contentLabel}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onFocusOutside={onFocusOutside}
        >
          {content}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export const PopoverClose = RadixPopover.Close;
