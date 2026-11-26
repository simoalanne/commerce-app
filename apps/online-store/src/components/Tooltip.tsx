"use client";

import { Tooltip as RadixTooltip } from "radix-ui";
import type { MouseEvent, ReactElement } from "react";
import { useState } from "react";

import styles from "./Tooltip.module.css";

type TooltipProps = {
  trigger: ReactElement;
  text: string;
  ariaTriggerLabel: string;
};

export function Tooltip({ trigger, text, ariaTriggerLabel }: TooltipProps) {
  const [open, setOpen] = useState(false);

  const handleTriggerClick = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setOpen((previousOpen) => !previousOpen);
  };

  return (
    <RadixTooltip.Root open={open} onOpenChange={setOpen}>
      <RadixTooltip.Trigger asChild aria-label={ariaTriggerLabel} onClick={handleTriggerClick}>
        {trigger}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className={styles.content}
          style={{ zIndex: 2147483647 }}
          side="top"
          sideOffset={8}
        >
          <p>{text}</p>
          <RadixTooltip.Arrow className={styles.arrow} width={10} height={6} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
