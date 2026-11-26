"use client";

import { isValidPostalCode } from "@acme/shared/utils/addressValidation";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AddressForm, type AddressFormValue } from "@/components/address-form";
import { createInitialAddress } from "@/components/address-form/createInitialAddress";
import { AsyncBoundary } from "@/components/async-boundary";
import { Modal } from "@/components/Modal";
import { SavedAddress } from "@/components/SavedAddress";
import { useApiClient } from "@/providers/ApiClientProvider";
import type { CustomerAddress } from "@/types/api";

import styles from "./AccountAddressesPage.module.css";

const emptyAddress: AddressFormValue = createInitialAddress();

export default function AccountAddressesPage() {
  return (
    <AsyncBoundary>
      <AccountAddressesPageContent />
    </AsyncBoundary>
  );
}

function AccountAddressesPageContent() {
  const t = useTranslations("accountAddressesPage");
  const { queryUtils } = useApiClient();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [draft, setDraft] = useState<AddressFormValue>(emptyAddress);
  const [fieldErrors, setFieldErrors] = useState<{
    line1: string | null;
    postalCode: string | null;
    city: string | null;
  }>({
    line1: null,
    postalCode: null,
    city: null,
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const { data } = useSuspenseQuery(
    queryUtils.user.addresses.list.queryOptions({
      select: (response) => response.body,
    }),
  );
  const addAddress = useMutation(queryUtils.user.addresses.create.mutationOptions());
  const updateAddress = useMutation(queryUtils.user.addresses.update.mutationOptions());
  const deleteAddress = useMutation(queryUtils.user.addresses.delete.mutationOptions());
  const addresses = data ?? [];
  const deletingId = deleteAddress.isPending
    ? (deleteAddress.variables?.params.addressId ?? null)
    : null;
  const isEditMode = editingAddress !== null;

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setEditingAddress(null);
    setDraft(emptyAddress);
    setFieldErrors({
      line1: null,
      postalCode: null,
      city: null,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (address: CustomerAddress) => {
    setEditingAddress(address);
    setDraft(address);
    setFieldErrors({
      line1: null,
      postalCode: null,
      city: null,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setFieldErrors((current) => ({
      line1: current.line1 && draft.line1.trim() ? null : current.line1,
      postalCode:
        current.postalCode && isValidPostalCode(draft.postalCode.trim())
          ? null
          : current.postalCode,
      city: current.city && draft.city.trim() ? null : current.city,
    }));
  }, [draft.city, draft.postalCode, draft.line1]);

  const handleDelete = (address: CustomerAddress) => {
    const confirmed = window.confirm(
      t("delete.confirmation", {
        address: `${address.line1}, ${address.postalCode} ${address.city}`,
      }),
    );

    if (!confirmed) {
      return;
    }

    deleteAddress.reset();
    deleteAddress.mutate(
      { params: { addressId: address.id } },
      {
        onSuccess() {
          void queryClient.invalidateQueries({
            queryKey: queryUtils.user.addresses.list.queryKey(),
          });
        },
      },
    );
  };

  const handleSubmit = async () => {
    const nextFieldErrors = {
      line1: draft.line1.trim()
        ? null
        : t("validation.requiredField", {
            field: t("fields.address"),
          }),
      postalCode: isValidPostalCode(draft.postalCode.trim())
        ? null
        : t("validation.invalidPostalCode"),
      city: draft.city.trim()
        ? null
        : t("validation.requiredField", {
            field: t("fields.city"),
          }),
    };

    setFieldErrors(nextFieldErrors);
    setModalError(null);

    if (Object.values(nextFieldErrors).some(Boolean)) {
      return;
    }

    const nextAddress = { ...draft, line2: draft.line2?.trim() || null };

    try {
      if (editingAddress) {
        await updateAddress.mutateAsync({
          params: { addressId: editingAddress.id },
          body: nextAddress,
        });

        void queryClient.invalidateQueries({
          queryKey: queryUtils.user.addresses.list.queryKey(),
        });
      } else {
        await addAddress.mutateAsync({ body: nextAddress });
        void queryClient.invalidateQueries({
          queryKey: queryUtils.user.addresses.list.queryKey(),
        });
      }

      closeModal();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : t("validation.genericSaveError"));
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>{t("title")}</h2>
          <p className={styles.headerText}>{t("description")}</p>
        </div>

        <div className={styles.toolbar}>
          <span className={styles.countChip}>{t("count", { count: addresses.length })}</span>
          <button type="button" className={styles.addButton} onClick={openCreateModal}>
            {t("add")}
          </button>
        </div>
      </header>

      {deleteAddress.error ? (
        <div className={styles.helperChip}>{deleteAddress.error.message}</div>
      ) : null}

      <div className={styles.surface}>
        {addresses.length > 0 ? (
          <div className={styles.list}>
            {addresses.map((address) => (
              <SavedAddress
                key={address.id}
                variant="actions"
                address={address.line1}
                postalCode={address.postalCode}
                city={address.city}
                onEdit={() => openEditModal(address)}
                onDelete={() => handleDelete(address)}
                editLabel={t("actions.edit")}
                deleteLabel={t("actions.delete")}
                deletingLabel={t("actions.deleting")}
                isDeleting={deletingId === address.id}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>{t("empty.title")}</h3>
            <p className={styles.emptyText}>{t("empty.description")}</p>
          </div>
        )}
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeModal();
            return;
          }

          setIsModalOpen(true);
        }}
        title={isEditMode ? t("modal.editTitle") : t("modal.createTitle")}
        subtitle={t("modal.subtitle")}
        contentClassName={styles.modalContent}
      >
        <div className={styles.modalBody}>
          <AddressForm
            address={draft}
            setAddress={setDraft}
            onPostalCodeValidate={(postalCode) => {
              if (!postalCode) {
                setFieldErrors((current) => ({
                  ...current,
                  postalCode: null,
                }));
                return;
              }

              setFieldErrors((current) => ({
                ...current,
                postalCode: isValidPostalCode(postalCode.trim())
                  ? null
                  : t("validation.invalidPostalCode"),
              }));
            }}
            errors={fieldErrors}
          />

          {modalError ? <p className={styles.modalError}>{modalError}</p> : null}

          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={closeModal}>
              {t("actions.cancel")}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleSubmit()}
              disabled={addAddress.isPending || updateAddress.isPending}
            >
              {addAddress.isPending || updateAddress.isPending
                ? t("actions.saving")
                : isEditMode
                  ? t("actions.save")
                  : t("actions.create")}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
