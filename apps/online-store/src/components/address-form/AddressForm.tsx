"use client";

import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";

import { TextField } from "@/components/forms/TextField";
import type { AddressDraft } from "@/types/api";

import styles from "./AddressForm.module.css";

export type AddressFormValue = AddressDraft & {
  id?: number;
};

type AddressFormProps = {
  address: AddressFormValue;
  setAddress: Dispatch<SetStateAction<AddressFormValue>>;
  onPostalCodeValidate?: (postalCode: string) => void;
  errors?: {
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
  };
};

export function AddressForm({
  address,
  setAddress,
  onPostalCodeValidate,
  errors,
}: AddressFormProps) {
  const t = useTranslations("addressForm");

  return (
    <div className={styles.form}>
      <div className={styles.fieldGrid}>
        <div className={styles.fieldGridFull}>
          <TextField
            id="address-form-address"
            name="street-address"
            label={t("address")}
            value={address.street}
            validationState={errors?.street ? "error" : "default"}
            helperText={errors?.street ?? undefined}
            onChange={(event) =>
              setAddress((current) => ({
                ...current,
                street: event.target.value,
              }))
            }
            autoComplete="street-address"
          />
        </div>
        <div className={styles.fieldGridFull}>
          <TextField
            id="address-form-apartment"
            name="address-line2"
            label={t("apartment")}
            isOptional
            value={address.apartment ?? ""}
            onChange={(event) =>
              setAddress((current) => ({
                ...current,
                apartment: event.target.value,
              }))
            }
            autoComplete="address-line2"
          />
        </div>
        <TextField
          id="address-form-postal-code"
          name="postal-code"
          label={t("postalCode")}
          value={address.postalCode}
          validationState={errors?.postalCode ? "error" : "default"}
          helperText={errors?.postalCode ?? undefined}
          onChange={(event) =>
            setAddress((current) => ({
              ...current,
              postalCode: event.target.value,
            }))
          }
          onBlur={(event) => onPostalCodeValidate?.(event.target.value.trim())}
          autoComplete="postal-code"
        />
        <TextField
          id="address-form-city"
          name="address-level2"
          label={t("city")}
          value={address.city}
          validationState={errors?.city ? "error" : "default"}
          helperText={errors?.city ?? undefined}
          onChange={(event) =>
            setAddress((current) => ({
              ...current,
              city: event.target.value,
            }))
          }
          autoComplete="address-level2"
        />
        <div className={styles.fieldGridFull}>
          <TextField
            id="address-form-delivery-instructions"
            label={t("deliveryInstructions")}
            aria-label={t("deliveryInstructions")}
            isOptional
            value={address.deliveryInstructions.freeForm ?? ""}
            onChange={(event) =>
              setAddress((current) => ({
                ...current,
                deliveryInstructions: {
                  ...current.deliveryInstructions,
                  freeForm: event.target.value,
                },
              }))
            }
            multiline
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
