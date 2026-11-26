import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

type LocalizedReadonlyFieldProps = {
  label: string;
  locale: string;
  value: string | string[] | null | undefined;
  textarea?: boolean;
  renderValue?: (value: string | string[]) => ReactNode;
  missingMessage?: string;
};

export function LocalizedReadonlyField({
  label,
  locale,
  value,
  textarea = false,
  renderValue,
  missingMessage,
}: LocalizedReadonlyFieldProps) {
  const hasValue =
    (typeof value === "string" && value.trim().length > 0) ||
    (Array.isArray(value) && value.length > 0);

  return (
    <Field>
      <FieldLabel>{`${label} (${locale.toUpperCase()})`}</FieldLabel>
      {hasValue ? (
        renderValue ? (
          renderValue(value as string | string[])
        ) : Array.isArray(value) ? (
          <div className="flex flex-wrap gap-2 rounded-md border bg-muted/20 px-3 py-3">
            {value.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>
        ) : (
          <div
            className={`rounded-md border bg-muted/20 px-3 py-3 text-sm ${textarea ? "min-h-24 whitespace-pre-wrap" : ""}`}
          >
            {value}
          </div>
        )
      ) : (
        <div className="rounded-md border border-dashed bg-amber-50/60 px-3 py-3 text-sm text-muted-foreground">
          {missingMessage ?? `This entity does not have this text in ${locale.toUpperCase()} yet.`}
        </div>
      )}
      <FieldDescription>Localized fields are read-only in this form.</FieldDescription>
    </Field>
  );
}
