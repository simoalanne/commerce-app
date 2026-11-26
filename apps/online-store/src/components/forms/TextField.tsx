"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import { Tooltip } from "@/components/Tooltip";

import styles from "./TextField.module.css";

type BaseProps = {
  label: string;
  isOptional?: boolean;
  tooltipText?: string;
  tooltipAriaTriggerLabel?: string;
  multiline?: boolean;
  helperText?: string;
  validationState?: "default" | "error" | "success";
};

type InputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "placeholder"> & {
    multiline?: false;
    trailingElement?: ReactNode;
  };

type TextareaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "children" | "placeholder"> & {
    multiline: true;
    trailingElement?: never;
  };

type TextFieldProps = InputProps | TextareaProps;

export function TextField({
  label,
  isOptional = false,
  tooltipText,
  tooltipAriaTriggerLabel,
  helperText,
  validationState = "default",
  multiline = false,
  ...props
}: TextFieldProps) {
  const { className, trailingElement, ...controlProps } = props;
  const controlClassName = [
    styles.control,
    multiline ? styles.textarea : "",
    trailingElement ? styles.controlWithTrailingElement : "",
    props.readOnly ? styles.controlReadonly : "",
    validationState === "error" ? styles.controlError : "",
    validationState === "success" ? styles.controlSuccess : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const helperClassName = [
    styles.helperText,
    validationState === "error" ? styles.helperTextError : "",
    validationState === "success" ? styles.helperTextSuccess : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <div className={styles.controlShell}>
        {multiline ? (
          <textarea
            {...(controlProps as TextareaProps)}
            className={controlClassName}
            placeholder=" "
            aria-invalid={validationState === "error"}
          />
        ) : (
          <input
            {...(controlProps as InputProps)}
            className={controlClassName}
            placeholder=" "
            aria-invalid={validationState === "error"}
          />
        )}
        {trailingElement ? <span className={styles.trailingElement}>{trailingElement}</span> : null}
        <label htmlFor={props.id} className={styles.floatingLabel}>
          <span>
            {label}
            {isOptional ? null : (
              <span aria-hidden="true" className={styles.requiredMark}>
                *
              </span>
            )}
          </span>
        </label>
        {tooltipText ? (
          <Tooltip
            text={tooltipText}
            ariaTriggerLabel={tooltipAriaTriggerLabel ?? ""}
            trigger={
              <button type="button" className={styles.tooltipButton}>
                ?
              </button>
            }
          />
        ) : null}
      </div>
      {helperText ? <span className={helperClassName}>{helperText}</span> : null}
    </div>
  );
}
