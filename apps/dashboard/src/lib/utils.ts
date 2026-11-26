import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Used to merge tailwind class names together, and remove duplicates. Useful for conditionally applying classes.
 * Even if you don't use this, shadcn/ui will assume this exists and
 * @param inputs
 * @returns
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
