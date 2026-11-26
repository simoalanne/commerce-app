import { VendorFormSchema as formSchema } from "@acme/shared/schemas/vendors";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { FormTextField, MultiImagePicker, TagEditor } from "@/components/forms";
import { MDXEditorControlled } from "@/components/forms/MDXEditorControlled.tsx";
import { StorefrontFields } from "@/components/storefront-fields";
import { Button } from "@/components/ui/button";
import type { EntityDialogContentProps } from "@/components/ui/entity-page";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { queryUtils } from "@/context/ApiClientContext";
import { useDashboardLocalization } from "@/context/LocalizationContext";

import "@mdxeditor/editor/style.css";

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

type VendorFormProps = EntityDialogContentProps<
  InferClientResponse<typeof queryUtils.vendors.getById.fetch>["body"]
>;

export default function VendorForm(props: VendorFormProps) {
  return <VendorFormContent {...props} />;
}

const VendorFormContent = ({ entityData, onSuccess }: VendorFormProps) => {
  const queryClient = useQueryClient();
  const { contentLocale } = useDashboardLocalization();
  const createVendorMutation = useMutation(queryUtils.vendors.create.mutationOptions());
  const updateVendorMutation = useMutation(queryUtils.vendors.update.mutationOptions());

  const fallbackDefaults: FormOutput = {
    name: "",
    slogan: "",
    story: "",
    storefront_visibility: "INACTIVE",
    is_featured: false,
    tags: [],
    images: [],
  };

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: entityData ? { ...entityData } : fallbackDefaults,
  });

  const isPending = createVendorMutation.isPending || updateVendorMutation.isPending;

  const onSubmit = form.handleSubmit(
    async (vendorData) => {
      if (entityData) {
        updateVendorMutation.mutate(
          { params: { id: entityData.id }, body: vendorData },
          {
            onSuccess() {
              toast.success("Vendor updated");
              queryClient.invalidateQueries({
                queryKey: queryUtils.vendors.getAll.queryKey(),
              });
              onSuccess?.();
            },
            onError(error) {
              toast.error(`Failed to update vendor: ${error.message}`);
            },
          },
        );
        return;
      }

      createVendorMutation.mutate(
        { body: vendorData },
        {
          onSuccess() {
            toast.success("Vendor created");
            queryClient.invalidateQueries({
              queryKey: queryUtils.vendors.getAll.queryKey(),
            });
            onSuccess?.();
          },
          onError(error) {
            toast.error(`Failed to create vendor: ${error.message}`);
          },
        },
      );
    },
    (validationErrors) => {
      console.error("Form Validation Failure Details:", validationErrors);
      toast.error("Form submission rejected. Please review field input requirements.");
    },
  );

  return (
    <form id="form-vendor" onSubmit={onSubmit} className="space-y-6">
      <FieldGroup>
        <FormTextField name="name" control={form.control} label="Name" placeholder="Vendor name" />
        <FormTextField
          name="slogan"
          control={form.control}
          label="Slogan"
          placeholder={`Short vendor slogan in ${contentLocale.toUpperCase()}`}
        />

        <StorefrontFields control={form.control} />

        <Controller
          name="story"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Story</FieldLabel>
              <MDXEditorControlled
                value={field.value ?? `Vendor story in ${contentLocale.toUpperCase()}`}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <TagEditor
          name="tags"
          control={form.control}
          placeholder="Add tags, press Enter to confirm"
          minTags={1}
        />
        <Controller
          name="images"
          control={form.control}
          render={({ field }) => (
            <MultiImagePicker
              value={field.value ?? []}
              onChange={field.onChange}
              label="Vendor images"
            />
          )}
        />
      </FieldGroup>

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset();
          }}
          disabled={isPending}
        >
          Reset
        </Button>
        <Button type="submit" form="form-vendor" disabled={isPending}>
          {entityData ? "Save changes" : "Create"}
        </Button>
      </div>
    </form>
  );
};
