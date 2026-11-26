import type { ChangeEventHandler, FocusEventHandler } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type FormTextFieldProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  supportMarkdown?: boolean;
  disabled?: boolean;
  disabledReasonLabel?: string;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  numberInput?: boolean;
};

const getFieldValue = (value: unknown) => {
  if (value == null) {
    return "";
  }

  return String(value);
};

export function FormTextField<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  textarea = false,
  supportMarkdown = false,
  disabled = false,
  disabledReasonLabel,
  onChange,
  onBlur,
  numberInput = false,
}: FormTextFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const resolvedName = String(name);
        const fieldError = fieldState.error;
        const fieldValue = getFieldValue(field.value);

        const inputId = resolvedName.replaceAll(".", "-");
        const disabledReason = disabled ? disabledReasonLabel : undefined;

        const handleChange = (nextValue: string) => {
          field.onChange(numberInput ? Number(nextValue) : nextValue);
        };

        const handleBlur: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement> = (event) => {
          field.onBlur();
          onBlur?.(event);
        };

        const handleInputChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (
          event,
        ) => {
          handleChange(event.target.value);
          onChange?.(event);
        };

        const inputControl = textarea ? (
          <Textarea
            id={inputId}
            value={fieldValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            aria-invalid={Boolean(fieldError)}
            supportMarkdown={supportMarkdown}
            disabled={disabled}
          />
        ) : (
          <Input
            id={inputId}
            value={fieldValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            aria-invalid={Boolean(fieldError)}
            disabled={disabled}
            type={numberInput ? "number" : "text"}
          />
        );

        return (
          <Field data-invalid={Boolean(fieldError)}>
            <FieldLabel htmlFor={inputId}>
              <span>{label}</span>
            </FieldLabel>
            {disabledReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block w-full">{inputControl}</span>
                </TooltipTrigger>
                <TooltipContent>{disabledReason}</TooltipContent>
              </Tooltip>
            ) : (
              inputControl
            )}
            {fieldError ? <FieldError errors={[fieldError]} /> : null}
          </Field>
        );
      }}
    />
  );
}
