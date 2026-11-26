"use client";

import styles from "./Select.module.css";

type SelectOption<T extends string> = {
  label: string;
  value: T;
};

type SelectProps<T extends string> = {
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

export function Select<T extends string>({ label, options, value, onChange }: SelectProps<T>) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.options}>
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
