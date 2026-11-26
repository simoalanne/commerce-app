import * as React from "react";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  supportMarkdown?: boolean;
};

export function Textarea({
  className,
  supportMarkdown = false,
  value,
  onChange,
  ...props
}: TextareaProps) {
  const [preview, setPreview] = React.useState(false);
  const content = typeof value === "string" ? value : "";

  return (
    <div className="relative w-full">
      {supportMarkdown && (
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={cn(
            "absolute -top-8 right-2 z-10 rounded-md border px-2 py-1 text-xs transition-colors",
            "bg-background hover:bg-muted",
            preview && "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          Preview Markdown
        </button>
      )}
      {preview ? (
        <div
          className={cn(
            "min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
            "prose prose-sm max-w-none dark:prose-invert",
            className,
          )}
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          data-slot="textarea"
          className={cn(
            "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
            className,
          )}
          value={value}
          onChange={onChange}
          disabled={preview}
          {...props}
        />
      )}
    </div>
  );
}
