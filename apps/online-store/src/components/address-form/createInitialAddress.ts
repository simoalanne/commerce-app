import type { AddressDraft } from "@/types/api";

const emptyAddress: AddressDraft = {
  street: "",
  city: "",
  postalCode: "",
  addressType: null,
  streetNumber: null,
  entrance: null,
  floor: null,
  apartment: null,
  deliveryInstructions: {},
};

export function createInitialAddress(initialAddress?: AddressDraft | null): AddressDraft {
  if (!initialAddress) {
    return emptyAddress;
  }

  return {
    ...emptyAddress,
    ...initialAddress,
    deliveryInstructions: {
      ...emptyAddress.deliveryInstructions,
      ...initialAddress.deliveryInstructions,
    },
  };
}
