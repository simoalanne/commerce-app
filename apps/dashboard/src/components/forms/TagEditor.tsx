import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TagEditorProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  placeholder?: string;
  minTags?: number;
}

export function TagEditor<TFieldValues extends FieldValues>({
  name,
  control,
  placeholder = "Add tag and press Enter",
  minTags,
}: TagEditorProps<TFieldValues>) {
  const [draft, setDraft] = useState("");

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        validate: (value) => {
          if (!minTags) {
            return true;
          }

          const tags = Array.isArray(value) ? value : [];
          return tags.length >= minTags || `Please add at least ${minTags} tag(s).`;
        },
      }}
      render={({ field, fieldState }) => {
        const tags = Array.isArray(field.value)
          ? (field.value as unknown[]).filter(
              (tag: unknown): tag is string => typeof tag === "string",
            )
          : [];

        const addTag = () => {
          const nextTag = draft.trim();
          if (!nextTag) {
            return;
          }

          const isDuplicate = tags.some(
            (existingTag: string) => existingTag.toLowerCase() === nextTag.toLowerCase(),
          );
          if (isDuplicate) {
            return;
          }

          field.onChange([...tags, nextTag]);
          setDraft("");
        };

        const removeTag = (tagToRemove: string) => {
          field.onChange(tags.filter((tag: string) => tag !== tagToRemove));
        };

        const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();
          addTag();
        };

        return (
          <div className="space-y-2">
            <div
              className="rounded-md border border-input p-2 focus-within:ring-[3px] focus-within:ring-ring/50"
              onBlur={field.onBlur}
            >
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    <span>{tag}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="h-4 w-4 rounded-full p-0 hover:opacity-100"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-3" />
                    </Button>
                  </Badge>
                ))}

                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={placeholder}
                  className="h-7 min-w-36 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
                  aria-invalid={fieldState.invalid}
                />
              </div>
            </div>

            {fieldState.error?.message ? (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            ) : null}
          </div>
        );
      }}
    />
  );
}
