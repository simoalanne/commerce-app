import type { AddressDraft } from "@/types/api";

// The store ships within Finland until the address form has a country field.
const emptyAddress: AddressDraft = {
  line1: "",
  line2: null,
  postalCode: "",
  city: "",
  country: "FI",
};

export function createInitialAddress(initialAddress?: AddressDraft | null): AddressDraft {
  return { ...emptyAddress, ...initialAddress };
}
