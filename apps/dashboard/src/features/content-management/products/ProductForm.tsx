import { ProductFormSchema as formSchema } from "@acme/shared/schemas/products";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type * as z from "zod";

import { FormTextField, MultiImagePicker, NumberInput } from "@/components/forms";
import { MDXEditorControlled } from "@/components/forms/MDXEditorControlled.tsx";
import { StorefrontFields } from "@/components/storefront-fields";
import { Button } from "@/components/ui/button";
import type { EntityDialogContentProps } from "@/components/ui/entity-page";
import { EntitySelect } from "@/components/ui/entity-select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { queryUtils } from "@/context/ApiClientContext";
import { useDashboardLocalization } from "@/context/LocalizationContext";

import { TagMultiSelect } from "./TagMultiSelect";

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

type ProductFormProps = EntityDialogContentProps<
  InferClientResponse<typeof queryUtils.products.getById.fetch>["body"]
>;

const DEFAULT_MARKUP_PERCENT = 0;
const roundPercent = (value: number) => Math.round(value * 10) / 10;
// Prices are integer cents.
const getSalesPriceFromMarkup = (costPrice: number, markupPercent: number) =>
  Math.round(costPrice * (1 + markupPercent / 100));
const getCostPriceFromMarkup = (salesPrice: number, markupPercent: number) =>
  Math.round(salesPrice / (1 + markupPercent / 100));
const getMarkupPercent = (costPrice: number, salesPrice: number) => {
  if (costPrice <= 0) {
    return DEFAULT_MARKUP_PERCENT;
  }

  return Math.max(0, roundPercent(((salesPrice - costPrice) / costPrice) * 100));
};

export default function ProductForm(props: ProductFormProps) {
  return <ProductFormContent {...props} />;
}

export function ProductFormContent({ entityData, onSuccess }: ProductFormProps) {
  const queryClient = useQueryClient();
  const { contentLocale } = useDashboardLocalization();
  const [searchParams] = useSearchParams();
  const createMutation = useMutation(queryUtils.products.create.mutationOptions());
  const updateMutation = useMutation(queryUtils.products.update.mutationOptions());
  const { data: productMarkupDefaults } = useQuery(
    queryUtils.categories.getProductMarkupDefaults.queryOptions({
      select: (r) => r.body,
    }),
  );

  const isEditMode = entityData !== undefined;
  const vendorDisabledReason = isEditMode
    ? "Vendor cannot be changed after creation to preserve order and fulfillment integrity"
    : undefined;
  const defaultVendorId = Number(searchParams.get("vendorId")) || undefined;
  const lockedDefaultVendorId = isEditMode ? undefined : defaultVendorId;

  const fallbackDefaults: FormOutput = {
    sku: "",
    name: "",
    weightGrams: 0,
    headline: "",
    fullDescription: "",
    storefrontVisibility: "INACTIVE",
    isFeatured: false,
    categoryId: null,
    tags: [],
    images: [],
    costPriceCents: 0,
    salesPriceCents: 0,
    currentStock: 0,
    purchaseLimitPerOrder: 0,
    vendorId: 0,
  };

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: entityData
      ? { ...entityData }
      : {
          ...fallbackDefaults,
          vendorId: defaultVendorId ?? fallbackDefaults.vendorId ?? 0,
        },
  });
  const [markupPercent, setMarkupPercent] = useState(() =>
    getMarkupPercent(
      entityData?.costPriceCents ?? fallbackDefaults.costPriceCents,
      entityData?.salesPriceCents ?? fallbackDefaults.salesPriceCents,
    ),
  );
  const isPending = createMutation.isPending || updateMutation.isPending;
  const categoryId = useWatch({
    control: form.control,
    name: "categoryId",
  });
  const costPrice = useWatch({ control: form.control, name: "costPriceCents" }) ?? 0;
  const salesPrice = useWatch({ control: form.control, name: "salesPriceCents" }) ?? 0;
  const categoryMarkupPercent = productMarkupDefaults?.categories.find(
    (category) => category.id === categoryId,
  )?.markupPercent;
  const expectedMarkupPercent =
    categoryMarkupPercent ?? productMarkupDefaults?.defaultMarkupPercent ?? DEFAULT_MARKUP_PERCENT;
  const isSellingBelowCost = salesPrice < costPrice;
  const isMarkupDifferentFromExpected =
    productMarkupDefaults !== undefined &&
    roundPercent(markupPercent) !== roundPercent(expectedMarkupPercent);
  const canBootstrapPriceFromMarkup = markupPercent > 0 && costPrice === 0 && salesPrice === 0;

  useEffect(() => {
    if (costPrice !== 0 || salesPrice !== 0) {
      return;
    }

    setMarkupPercent(expectedMarkupPercent);
  }, [costPrice, expectedMarkupPercent, salesPrice]);

  const updateSalesPriceFromMarkup = (nextMarkupPercent: number) => {
    form.setValue("salesPriceCents", getSalesPriceFromMarkup(costPrice, nextMarkupPercent), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const onSubmit = form.handleSubmit(
    (data) => {
      if (entityData) {
        updateMutation.mutate(
          { params: { id: entityData.id }, body: data },
          {
            onSuccess() {
              toast.success("Product updated");
              queryClient.invalidateQueries({
                queryKey: queryUtils.products.getAll.queryKey(),
              });
              onSuccess?.();
            },
            onError(error) {
              toast.error(`Failed to update product: ${error.message}`);
            },
          },
        );
        return;
      }

      createMutation.mutate(
        { body: data },
        {
          onSuccess() {
            toast.success("Product created");
            queryClient.invalidateQueries({
              queryKey: queryUtils.products.getAll.queryKey(),
            });
            form.reset();
            onSuccess?.();
          },
          onError(error) {
            toast.error(`Failed to create product: ${error.message}`);
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
    <form id="form-product" onSubmit={onSubmit}>
      <FieldGroup>
        <FormTextField
          name="sku"
          control={form.control}
          label="SKU"
          placeholder="e.g. FARM-APPLE-001"
          disabled={isEditMode}
          disabledReasonLabel={
            isEditMode ? "SKU cannot be edited to preserve data integrity" : undefined
          }
        />

        <Controller
          name="vendorId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Vendor</FieldLabel>
              {vendorDisabledReason ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block w-full">
                      <EntitySelect
                        options={queryUtils.vendors.getOptionsForForm.queryOptions({
                          select: (r) => r.body,
                        })}
                        defaultValue={lockedDefaultVendorId}
                        label="Vendor"
                        placeholder="Select a vendor..."
                        value={field.value ?? ""}
                        onChange={(val) => field.onChange(val ? Number(val) : undefined)}
                        triggerClassName="w-full"
                        width="100%"
                        disabled={true}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{vendorDisabledReason}</TooltipContent>
                </Tooltip>
              ) : (
                <EntitySelect
                  options={queryUtils.vendors.getOptionsForForm.queryOptions({
                    select: (r) => r.body,
                  })}
                  defaultValue={lockedDefaultVendorId}
                  label="Vendor"
                  placeholder="Select a vendor..."
                  value={field.value ?? ""}
                  onChange={(val) => field.onChange(val ? Number(val) : undefined)}
                  triggerClassName="w-full"
                  width="100%"
                />
              )}
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="categoryId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Category</FieldLabel>
              <EntitySelect
                options={queryUtils.categories.getOptionsForForm.queryOptions({
                  select: (r) => r.body,
                })}
                label="Category"
                placeholder="Select category..."
                value={field.value ?? ""}
                onChange={(val) => field.onChange(val ? Number(val) : null)}
                triggerClassName="w-full"
                width="100%"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <FormTextField
          name="name"
          control={form.control}
          label="Name"
          placeholder={`Product name in ${contentLocale.toUpperCase()}`}
        />
        <FormTextField
          name="headline"
          control={form.control}
          label="Headline"
          placeholder={`Short product headline in ${contentLocale.toUpperCase()}`}
        />

        <Controller
          name="fullDescription"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Full Description</FieldLabel>
              <MDXEditorControlled
                value={
                  field.value ?? `Detailed product description in ${contentLocale.toUpperCase()}`
                }
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <Field>
          <FieldLabel>Weight</FieldLabel>
          <NumberInput
            name="weightGrams"
            control={form.control}
            min={0}
            step={1}
            endSymbol="g"
            placeholder="0"
          />
          {form.formState.errors.weightGrams ? (
            <FieldError errors={[form.formState.errors.weightGrams]} />
          ) : null}
        </Field>

        <Field>
          <FieldLabel>Cost Price</FieldLabel>
          <NumberInput
            name="costPriceCents"
            control={form.control}
            startSymbol="€"
            cents
            min={0}
            step={0.01}
            onValueChange={(nextCostPrice) => {
              if (canBootstrapPriceFromMarkup && nextCostPrice != null && nextCostPrice > 0) {
                form.setValue(
                  "salesPriceCents",
                  getSalesPriceFromMarkup(nextCostPrice, markupPercent),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                );
                return;
              }

              setMarkupPercent(getMarkupPercent(nextCostPrice ?? 0, salesPrice));
            }}
          />
          {form.formState.errors.costPriceCents ? (
            <FieldError errors={[form.formState.errors.costPriceCents]} />
          ) : null}
        </Field>

        <Field>
          <FieldLabel>Markup</FieldLabel>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              value={markupPercent}
              min={0}
              step={0.1}
              onChange={(event) => {
                const nextMarkupPercent = Math.max(0, Number(event.target.value) || 0);
                setMarkupPercent(nextMarkupPercent);
                updateSalesPriceFromMarkup(nextMarkupPercent);
              }}
              className="pr-8"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          {isMarkupDifferentFromExpected ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {`Markup of ${roundPercent(markupPercent)}% differs from expected markup of ${roundPercent(expectedMarkupPercent)}%.`}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel>Sales Price</FieldLabel>
          <NumberInput
            name="salesPriceCents"
            control={form.control}
            startSymbol="€"
            cents
            min={0}
            step={0.01}
            onValueChange={(nextSalesPrice) => {
              if (canBootstrapPriceFromMarkup && nextSalesPrice != null && nextSalesPrice > 0) {
                form.setValue(
                  "costPriceCents",
                  getCostPriceFromMarkup(nextSalesPrice, markupPercent),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                );
                return;
              }

              setMarkupPercent(getMarkupPercent(costPrice, nextSalesPrice ?? 0));
            }}
          />
          {form.formState.errors.salesPriceCents ? (
            <FieldError errors={[form.formState.errors.salesPriceCents]} />
          ) : null}
        </Field>

        {isSellingBelowCost ? (
          <p className="text-sm text-destructive">Sales price is below cost price.</p>
        ) : null}

        <StorefrontFields control={form.control} />

        <Field>
          <FieldLabel>Current Stock</FieldLabel>
          <NumberInput
            name="currentStock"
            control={form.control}
            min={0}
            step={1}
            placeholder="0"
          />
          {form.formState.errors.currentStock ? (
            <FieldError errors={[form.formState.errors.currentStock]} />
          ) : null}
        </Field>

        <Field>
          <FieldLabel>Purchase limit per order</FieldLabel>
          <NumberInput
            name="purchaseLimitPerOrder"
            control={form.control}
            min={0}
            max={99}
            step={1}
            placeholder="0 for no limit"
          />
          {form.formState.errors.purchaseLimitPerOrder ? (
            <FieldError errors={[form.formState.errors.purchaseLimitPerOrder]} />
          ) : null}
        </Field>

        <Controller
          name="tags"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Tags</FieldLabel>
              <TagMultiSelect value={field.value ?? []} onChange={field.onChange} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="images"
          control={form.control}
          render={({ field }) => (
            <MultiImagePicker
              value={field.value ?? []}
              onChange={field.onChange}
              label="Product images"
            />
          )}
        />
      </FieldGroup>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isPending}>
          Reset
        </Button>
        <Button type="submit" form="form-product" disabled={isPending}>
          {isEditMode ? "Save changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}
