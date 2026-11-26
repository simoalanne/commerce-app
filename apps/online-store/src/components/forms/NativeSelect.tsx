"use client";

import styles from "./NativeSelect.module.css";

type SelectOption<T extends string> = {
  label: string;
  value: T;
};

type NativeSelectProps<T extends string> = {
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

export function NativeSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: NativeSelectProps<T>) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
        className={styles.select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
