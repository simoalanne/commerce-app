"use client";

import { isValidPhoneNumber } from "@acme/shared/utils/addressValidation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type SubmitEvent, useState } from "react";

import { isValidAuthEmail } from "@/components/auth/authValidation.ts";
import { useApiClient } from "@/providers/ApiClientProvider";

import styles from "./ContactSubmissionForm.module.css";

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

type ContactSubmissionFormProps = {
  submissionType: "contact" | "vendorApplication";
};

const emptyForm: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  message: "",
};

export default function ContactSubmissionForm({ submissionType }: ContactSubmissionFormProps) {
  const { queryUtils } = useApiClient();
  const t = useTranslations("contactForms");
  const [form, setForm] = useState<ContactFormState>(emptyForm);
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const updateField =
    (field: keyof ContactFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const contactMutation = useMutation(
    queryUtils.contactSubmissions.submitContact.mutationOptions(),
  );
  const vendorApplicationMutation = useMutation(
    queryUtils.contactSubmissions.submitVendorApplication.mutationOptions(),
  );
  const submitMutation = submissionType === "contact" ? contactMutation : vendorApplicationMutation;

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      message: form.message.trim(),
    };

    if (!payload.email && !payload.phone) {
      setStatus({
        tone: "error",
        message: t("contactMethodRequired"),
      });
      return;
    }

    if (payload.email && !isValidAuthEmail(payload.email)) {
      setStatus({
        tone: "error",
        message: t("emailInvalid"),
      });
      return;
    }

    if (payload.phone && !isValidPhoneNumber(payload.phone)) {
      setStatus({
        tone: "error",
        message: t("phoneInvalid"),
      });
      return;
    }

    setStatus(null);

    try {
      await submitMutation.mutateAsync({ body: payload });
      setForm(emptyForm);
      setStatus({
        tone: "success",
        message: t("success"),
      });
    } catch {
      setStatus({
        tone: "error",
        message: t("unexpectedError"),
      });
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <p className={styles.hint}>{t("contactMethodHint")}</p>
      {status ? (
        <p className={status.tone === "success" ? styles.statusSuccess : styles.statusError}>
          {status.message}
        </p>
      ) : null}
      <div className={styles.rowTwo}>
        <input
          className={styles.input}
          name="name"
          placeholder={t("name")}
          aria-label={t("name")}
          autoComplete="name"
          required
          value={form.name}
          onChange={updateField("name")}
        />
        <input
          className={styles.input}
          name="email"
          placeholder={t("email")}
          aria-label={t("email")}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={updateField("email")}
        />
      </div>

      <input
        className={styles.input}
        name="phone"
        placeholder={t("phone")}
        aria-label={t("phone")}
        type="tel"
        autoComplete="tel"
        value={form.phone}
        onChange={updateField("phone")}
      />

      <textarea
        className={styles.textarea}
        name="message"
        placeholder={t("msg")}
        aria-label={t("msg")}
        required
        value={form.message}
        onChange={updateField("message")}
      />

      <button className={styles.button} type="submit" disabled={submitMutation.isPending}>
        {submitMutation.isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
