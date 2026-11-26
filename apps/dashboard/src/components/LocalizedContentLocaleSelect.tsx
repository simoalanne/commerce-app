import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ContentLocale, contentLocales } from "@/lib/locales";

const localeLabels: Record<ContentLocale, string> = {
  en: "English",
};

type LocalizedContentLocaleSelectProps = {
  value: ContentLocale;
  onValueChange: (locale: ContentLocale) => void;
  label?: string;
  placeholder?: string;
  triggerClassName?: string;
};

export function LocalizedContentLocaleSelect({
  value,
  onValueChange,
  label = "Content language",
  placeholder = "Select language",
  triggerClassName,
}: LocalizedContentLocaleSelectProps) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <Select
        value={value}
        onValueChange={(nextLocale) => onValueChange(nextLocale as ContentLocale)}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {contentLocales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {localeLabels[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
