"use client";

import { type RefObject, useId } from "react";

import styles from "./SearchModalProductsList.module.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ref: RefObject<HTMLInputElement | null>;
}

export default function SearchModalInput({ value, onChange, placeholder, ref }: Props) {
  const id = useId();

  return (
    <div style={{ paddingBottom: 10 }}>
      <label htmlFor={id} style={{ display: "none" }}>
        Search
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search products..."}
        className={styles.input}
        ref={ref}
      />
    </div>
  );
}
