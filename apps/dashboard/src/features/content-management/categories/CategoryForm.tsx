import { CategoryFormSchema as formSchema } from "@acme/shared/schemas/categories";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { FormTextField, MultiImagePicker, NumberInput } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { EntityDialogContentProps } from "@/components/ui/entity-page";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { queryUtils } from "@/context/ApiClientContext";
import { useDashboardLocalization } from "@/context/LocalizationContext";

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

type CategoryFormProps = EntityDialogContentProps<
  InferClientResponse<typeof queryUtils.categories.getById.fetch>["body"]
>;

export function CategoryForm({ entityData, onSuccess }: CategoryFormProps) {
  const queryClient = useQueryClient();
  const { contentLocale } = useDashboardLocalization();

  const createMutation = useMutation(queryUtils.categories.create.mutationOptions());
  const updateMutation = useMutation(queryUtils.categories.update.mutationOptions());
  const [markupEnabled, setMarkupEnabled] = useState(entityData?.markupPercent != null);

  const fallbackDefaults: FormOutput = {
    name: entityData?.name ?? "",
    markupPercent: entityData?.markupPercent ?? null,
    imageId: entityData?.imageId ?? 0,
  };

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: fallbackDefaults,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function setMarkupEditing(enabled: boolean) {
    setMarkupEnabled(enabled);
    form.setValue("markupPercent", enabled ? 0 : null, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function resetForm() {
    setMarkupEnabled(entityData?.markupPercent != null);
    form.reset(fallbackDefaults);
  }

  function invalidateCategories() {
    queryClient.invalidateQueries({
      queryKey: queryUtils.categories.getAll.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: queryUtils.categories.getProductMarkupDefaults.queryKey(),
    });
  }

  function onSubmit(data: FormOutput) {
    if (entityData) {
      updateMutation.mutate(
        { params: { id: entityData.id }, body: data },
        {
          onSuccess() {
            toast.success("Category updated");
            invalidateCategories();
            onSuccess?.();
          },
          onError(error) {
            toast.error(`Failed to update category: ${error.message}`);
          },
        },
      );
    } else {
      createMutation.mutate(
        { body: data },
        {
          onSuccess() {
            toast.success("Category created");
            invalidateCategories();
            resetForm();
            onSuccess?.();
          },
          onError(error) {
            toast.error(`Failed to create category: ${error.message}`);
          },
        },
      );
    }
  }

  return (
    <form id="form-category" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <FormTextField
          name="name"
          control={form.control}
          label="Name"
          placeholder={`Category name in ${contentLocale.toUpperCase()}`}
        />

        <Field orientation="horizontal" className="w-fit gap-2">
          <Checkbox
            checked={markupEnabled}
            onCheckedChange={(checked) => setMarkupEditing(checked === true)}
          />
          <FieldContent>
            <FieldLabel className="cursor-pointer" onClick={() => setMarkupEditing(!markupEnabled)}>
              Set product markup for this category
            </FieldLabel>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Markup</FieldLabel>
          <FieldDescription>
            Products belonging to this category suggest this markup as their default value.
          </FieldDescription>
          <NumberInput
            name="markupPercent"
            control={form.control}
            min={0}
            step={0.1}
            endSymbol="%"
            disabled={!markupEnabled}
            emptyValue={null}
          />
          {form.formState.errors.markupPercent ? (
            <FieldError errors={[form.formState.errors.markupPercent]} />
          ) : null}
        </Field>

        <Controller
          name="imageId"
          control={form.control}
          render={({ field }) => (
            <MultiImagePicker
              value={field.value ? [field.value] : []}
              onChange={(value) => field.onChange(value[0] ?? 0)}
              label="Category image"
            />
          )}
        />
      </FieldGroup>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
          Reset
        </Button>
        <Button type="submit" form="form-category" disabled={isPending}>
          {entityData ? "Update Category" : "Create Category"}
        </Button>
      </div>
    </form>
  );
}
