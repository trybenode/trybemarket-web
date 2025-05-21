import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(...inputs));
}

export function formatNumber(value) {
  if (value === undefined) return "0"

  // Convert to string if it's a number
  const stringValue = typeof value === "number" ? value.toString() : value

  // Remove any existing commas
  const withoutCommas = stringValue.replace(/,/g, "")

  // Add commas for thousands
  return withoutCommas.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
