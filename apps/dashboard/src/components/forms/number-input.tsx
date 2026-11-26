import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumberInputProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  min?: number;
  max?: number;
  step?: number;
  startSymbol?: string;
  endSymbol?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyValue?: number | null;
  /** The field holds integer cents; the input shows and accepts euros. */
  cents?: boolean;
  onValueChange?: (value: number | null) => void;
}

export function NumberInput<TFieldValues extends FieldValues>({
  control,
  name,
  min,
  max,
  step,
  startSymbol,
  endSymbol,
  placeholder,
  disabled,
  className,
  emptyValue,
  cents = false,
  onValueChange,
}: NumberInputProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="relative">
          {startSymbol ? (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              {startSymbol}
            </span>
          ) : null}
          <Input
            type="number"
            inputMode="decimal"
            value={field.value == null ? "" : cents ? field.value / 100 : field.value}
            onChange={(e) => {
              let raw = e.target.value;

              if (raw === "") {
                if (emptyValue !== undefined) {
                  field.onChange(emptyValue);
                  onValueChange?.(emptyValue);
                }
                return;
              }

              raw = raw.replace(",", ".");

              // replace leading zero on first digit
              if (raw.length === 2 && raw.startsWith("0") && raw[1] !== ".") {
                raw = raw[1];
              }

              raw = raw.replace(/^0+(?=\d)/, "");

              const parsed = cents ? Math.round(Number(raw) * 100) : Number(raw);

              if (!Number.isNaN(parsed)) {
                // force UI sync because browser refuses to sync "01" -> "1" on its own
                //e.target.value commented bcause it caused problems when writing price

                // e.target.value = raw;
                field.onChange(parsed);
                onValueChange?.(parsed);
              }
            }}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            className={cn(startSymbol && "pl-8", endSymbol && "pr-14", className)}
          />
          {endSymbol ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              {endSymbol}
            </span>
          ) : null}
        </div>
      )}
    />
  );
}
