import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useFormState } from "react-hook-form";

import { NumberInput } from "@/components/forms";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

type FormNumberFieldProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  startSymbol?: string;
  endSymbol?: string;
  disabled?: boolean;
  className?: string;
};

const getErrorAtPath = (value: unknown, path: string) =>
  path
    .split(".")
    .reduce<unknown>(
      (current, segment) =>
        typeof current === "object" && current !== null
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      value,
    );

export function FormNumberField<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  min,
  max,
  step,
  startSymbol,
  endSymbol,
  disabled,
  className,
}: FormNumberFieldProps<TFieldValues>) {
  const { errors } = useFormState({
    control,
    name,
  });
  const fieldError = getErrorAtPath(errors, String(name));

  return (
    <Field data-invalid={Boolean(fieldError)}>
      <FieldLabel>{label}</FieldLabel>
      <NumberInput
        name={name}
        control={control}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        startSymbol={startSymbol}
        endSymbol={endSymbol}
        disabled={disabled}
        className={className}
      />
      {fieldError ? <FieldError errors={[fieldError]} /> : null}
    </Field>
  );
}
