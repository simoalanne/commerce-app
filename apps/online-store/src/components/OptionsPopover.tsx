"use client";

import type { ReactElement } from "react";

import { Popover, PopoverClose } from "@/components/Popover";
import { Link } from "@/i18n/navigation";

import styles from "./OptionsPopover.module.css";

type OptionWithValue = {
  value: string;
};

type OptionsPopoverProps<T extends string | OptionWithValue> = {
  options: T[];
  selected?: T;
  onSelect?: (option: T) => void;
  getDisplayName: (option: T) => string;
  valueIsHref?: boolean;
  trigger?: ReactElement;
  anchor?: ReactElement;
  contentAriaLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function getOptionValue<T extends string | OptionWithValue>(option: T) {
  return typeof option === "string" ? option : option.value;
}

export function OptionsPopover<T extends string | OptionWithValue>({
  options,
  selected,
  onSelect,
  getDisplayName,
  valueIsHref = false,
  trigger,
  anchor,
  contentAriaLabel,
  open,
  onOpenChange,
}: OptionsPopoverProps<T>) {
  const selectedValue = selected ? getOptionValue(selected) : null;

  return (
    <Popover
      anchor={anchor}
      open={open}
      onOpenChange={onOpenChange}
      contentLabel={contentAriaLabel}
      contentClassName={styles.content}
      content={
        <ul className={styles.optionList}>
          {options.map((option) => {
            const optionLabel = getDisplayName(option);
            const optionValue = getOptionValue(option);
            const isSelected = selectedValue === optionValue;
            const optionClassName = [
              styles.optionAction,
              isSelected ? styles.optionActionSelected : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={optionValue}>
                <PopoverClose asChild>
                  {valueIsHref ? (
                    <Link
                      href={optionValue}
                      className={optionClassName}
                      onClick={() => onSelect?.(option)}
                    >
                      {optionLabel}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={optionClassName}
                      onClick={() => onSelect?.(option)}
                    >
                      {optionLabel}
                    </button>
                  )}
                </PopoverClose>
              </li>
            );
          })}
        </ul>
      }
    >
      {trigger}
    </Popover>
  );
}
