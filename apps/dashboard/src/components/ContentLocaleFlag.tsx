import type { ContentLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

const localeFlagCountryCodes: Record<ContentLocale, string> = {
  en: "gb",
};

export const contentLocaleLabels: Record<ContentLocale, string> = {
  en: "English",
};

type ContentLocaleFlagProps = {
  locale: ContentLocale;
  label?: string;
  className?: string;
};

export function ContentLocaleFlag({
  locale,
  label = contentLocaleLabels[locale],
  className,
}: ContentLocaleFlagProps) {
  return (
    <div
      className={cn("h-6 w-6 overflow-hidden rounded-full border bg-muted shadow-xs", className)}
    >
      <img
        src={`https://flagcdn.com/${localeFlagCountryCodes[locale]}.svg`}
        alt={`${label} flag`}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
