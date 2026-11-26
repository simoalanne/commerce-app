"use client";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { OptionsPopover } from "@/components/OptionsPopover";

import styles from "@/components/OptionsPopover.module.css";

type FilterDropdownProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function FilterDropdown({ value, onChange }: FilterDropdownProps) {
  const t = useTranslations("productListing.filters.sort");
  const options = [
    { value: "default", label: t("clear") },
    { value: "name-asc", label: t("options.nameAsc") },
    { value: "rating-desc", label: t("options.ratingDesc") },
    { value: "price-asc", label: t("options.priceAsc") },
    { value: "price-desc", label: t("options.priceDesc") },
  ];

  const selectedLabel =
    !value || value === "default"
      ? t("label")
      : options.find((o) => o.value === value)?.label || t("label");
  const selectedOption = options.find((option) => option.value === value);

  return (
    <OptionsPopover
      options={options}
      selected={selectedOption}
      onSelect={(option) => onChange(option.value)}
      getDisplayName={(option) => option.label}
      contentAriaLabel={t("label")}
      trigger={
        <button type="button" className={styles.triggerButton} aria-label={t("open")}>
          {selectedLabel}
          <ChevronDown size={20} />
        </button>
      }
    />
  );
}
