// Deliberately loose, country-agnostic checks: they catch typos, not
// unreachable numbers or unknown postal codes.

const phoneNumberPattern = /^\+?\d{6,15}$/;

const normalizePhoneNumber = (value: string) => value.trim().replaceAll(/[\s\-()]/g, "");

export const isValidPhoneNumber = (value: string) =>
  phoneNumberPattern.test(normalizePhoneNumber(value));

const postalCodePattern = /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/;

export const isValidPostalCode = (value: string) => postalCodePattern.test(value.trim());
