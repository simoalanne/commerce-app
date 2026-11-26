import { ImageMetadataSchema } from "@acme/shared/schemas/images";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import type z from "zod";

import { FormTextField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { useDashboardLocalization } from "@/context/LocalizationContext";

const imageFormSchema = ImageMetadataSchema;

type ImageFormInput = z.input<typeof imageFormSchema>;
export type ImageFormValues = z.output<typeof imageFormSchema>;

const defaultValues: ImageFormValues = {
  name: "",
  alt: null,
};

type ImageFormProps = {
  formId: string;
  initialValues?: ImageFormValues;
  submitLabel: string;
  onSubmit: (values: ImageFormValues) => void;
  isPending?: boolean;
  footer?: ReactNode;
};

export function ImageForm({
  formId,
  initialValues = defaultValues,
  submitLabel,
  onSubmit,
  isPending = false,
  footer,
}: ImageFormProps) {
  const { contentLocale } = useDashboardLocalization();
  const form = useForm<ImageFormInput, unknown, ImageFormValues>({
    resolver: zodResolver(imageFormSchema),
    defaultValues: initialValues,
  });

  const handleReset = () => {
    form.reset(initialValues);
  };

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <FormTextField
          name="name"
          control={form.control}
          label="Internal name"
          placeholder="e.g. Spring hero image"
        />
        <FormTextField
          name="alt"
          control={form.control}
          label="Alt text"
          placeholder={`Alt text in ${contentLocale.toUpperCase()}`}
        />
      </FieldGroup>

      <div className="mt-6 flex justify-end gap-2">
        {footer ?? (
          <>
            <Button type="button" variant="outline" onClick={handleReset} disabled={isPending}>
              Reset
            </Button>
            <Button type="submit" disabled={isPending}>
              {submitLabel}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
