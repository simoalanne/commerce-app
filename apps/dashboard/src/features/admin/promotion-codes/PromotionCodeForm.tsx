import {
  PromotionCodeFormSchema as formSchema,
  PromotionCodeDiscountTypeSchema,
} from "@acme/shared/schemas/promotionCodes";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
  useForm,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { FormSection } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryUtils } from "@/context/ApiClientContext";

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

type PromotionCode = InferClientResponse<typeof queryUtils.promotionCodes.getById.fetch>["body"];

type PromotionCodeFormProps = EntityDialogContentProps<PromotionCode>;

const discountTypeLabels: Record<z.infer<typeof PromotionCodeDiscountTypeSchema>, string> = {
  PERCENT: "Percent",
  FIXED: "Fixed amount",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const isDate = (value: unknown): value is Date =>
  typeof value === "object" && value instanceof Date;

// The form edits Dates, while the response carries ISO strings.
const toFormValues = (promotionCode: PromotionCode): FormOutput => ({
  ...promotionCode,
  validFrom: promotionCode.validFrom ? new Date(promotionCode.validFrom) : null,
  validUntil: promotionCode.validUntil ? new Date(promotionCode.validUntil) : null,
  createdAt: new Date(promotionCode.createdAt),
  updatedAt: new Date(promotionCode.updatedAt),
});

type NumberFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  description?: string;
  startSymbol?: string;
  endSymbol?: string;
  step?: number;
  min?: number;
  nullable?: boolean;
  disabled?: boolean;
  /** The field holds integer cents; the input shows and accepts euros. */
  cents?: boolean;
};

function NumberField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  startSymbol,
  endSymbol,
  step = 0.01,
  min,
  nullable = false,
  disabled = false,
  cents = false,
}: NumberFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>{label}</FieldLabel>
          <InputGroup data-disabled={disabled || undefined}>
            {startSymbol ? (
              <InputGroupAddon>
                <InputGroupText>{startSymbol}</InputGroupText>
              </InputGroupAddon>
            ) : null}
            <InputGroupInput
              type="number"
              inputMode="decimal"
              value={field.value == null ? "" : String(cents ? field.value / 100 : field.value)}
              onChange={(event) => {
                const rawValue = event.target.value.replace(",", ".");

                if (rawValue === "") {
                  field.onChange(nullable ? null : undefined);
                  return;
                }

                const parsed = cents ? Math.round(Number(rawValue) * 100) : Number(rawValue);

                if (!Number.isNaN(parsed)) {
                  field.onChange(parsed);
                }
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder={placeholder}
              min={min}
              step={step}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            {endSymbol ? (
              <InputGroupAddon align="inline-end">
                <InputGroupText>{endSymbol}</InputGroupText>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

type DateFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description: string;
  boundary: "start" | "end";
  disabled?: boolean;
};

function DateField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  boundary,
  disabled = false,
}: DateFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>{label}</FieldLabel>
            {field.value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => field.onChange(null)}
                disabled={disabled}
              >
                <XIcon className="mr-1 h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
                disabled={disabled}
              >
                <span>{isDate(field.value) ? format(field.value, "PPP") : "Select date"}</span>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={isDate(field.value) ? field.value : undefined}
                onSelect={(nextDate) => {
                  if (!nextDate) {
                    field.onChange(null);
                    return;
                  }

                  field.onChange(boundary === "start" ? startOfDay(nextDate) : endOfDay(nextDate));
                }}
              />
            </PopoverContent>
          </Popover>
          <FieldDescription>{description}</FieldDescription>
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

export default function PromotionCodeForm({ entityData, onSuccess }: PromotionCodeFormProps) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(queryUtils.promotionCodes.create.mutationOptions());
  const updateMutation = useMutation(queryUtils.promotionCodes.update.mutationOptions());

  const fallbackDefaults: FormOutput = {
    code: "",
    isActive: true,
    validFrom: null,
    validUntil: null,
    minimumItemsValueCents: null,
    discountType: "PERCENT",
    discountValue: 0,
    usageLimit: null,
    timesUsed: 0,
    createdAt: undefined,
    updatedAt: undefined,
  };

  const formDefaults = entityData ? toFormValues(entityData) : fallbackDefaults;

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: formDefaults,
  });

  const isEditMode = entityData !== undefined;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const discountType = useWatch({
    control: form.control,
    name: "discountType",
  });
  const isPercentDiscount = discountType?.endsWith("PERCENT") ?? false;

  const onSubmit = form.handleSubmit((data) => {
    if (entityData) {
      updateMutation.mutate(
        { params: { id: entityData.id }, body: data },
        {
          onSuccess() {
            toast.success("Promotion code updated");
            queryClient.invalidateQueries({
              queryKey: queryUtils.promotionCodes.getAll.queryKey(),
            });
            onSuccess?.();
          },
          onError(error) {
            toast.error(`Failed to update promotion code: ${error.message}`);
          },
        },
      );
      return;
    }

    createMutation.mutate(
      { body: data },
      {
        onSuccess() {
          toast.success("Promotion code created");
          queryClient.invalidateQueries({
            queryKey: queryUtils.promotionCodes.getAll.queryKey(),
          });
          form.reset(fallbackDefaults);
          onSuccess?.();
        },
        onError(error) {
          toast.error(`Failed to create promotion code: ${error.message}`);
        },
      },
    );
  });

  return (
    <form id="form-promotion-code" onSubmit={onSubmit} className="space-y-6">
      <FormSection
        title="Basics"
        description="Create a code and decide whether it can be used right away."
      >
        <FieldGroup>
          <Controller
            name="code"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="promotion-code-code">Code</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    id="promotion-code-code"
                    value={field.value ?? ""}
                    placeholder="Acme10"
                    onChange={(event) => field.onChange(event.target.value)}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                </InputGroup>
                <FieldDescription>
                  The code customers will enter at checkout. Casing only matters for display here.
                  At checkout, code matching is case-insensitive.
                </FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />

          <Controller
            name="isActive"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                />
                <FieldContent>
                  <FieldLabel>Active</FieldLabel>
                  <FieldDescription>
                    Inactive codes stay in the system but cannot be applied.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
          />
        </FieldGroup>
      </FormSection>

      <FormSection
        title="Discount Rules"
        description="Define what the code discounts and when it should be available."
      >
        <FieldGroup>
          <Controller
            name="discountType"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Discount type</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PromotionCodeDiscountTypeSchema.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {discountTypeLabels[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />

          <NumberField
            control={form.control}
            name="discountValue"
            label="Discount value"
            placeholder={isPercentDiscount ? "10" : "5.00"}
            endSymbol={isPercentDiscount ? "%" : undefined}
            startSymbol={isPercentDiscount ? undefined : "€"}
            step={isPercentDiscount ? 1 : 0.01}
            cents={!isPercentDiscount}
            min={0}
            disabled={isPending}
          />

          <NumberField
            control={form.control}
            name="minimumItemsValueCents"
            label="Minimum items subtotal"
            placeholder="50.00"
            startSymbol="€"
            step={0.01}
            cents
            min={0}
            nullable={true}
            disabled={isPending}
            description="Leave empty for no minimum."
          />

          <DateField
            control={form.control}
            name="validFrom"
            label="Valid from"
            description="The code cannot be applied before this date. Leave empty for immediate availability."
            boundary="start"
            disabled={isPending}
          />

          <DateField
            control={form.control}
            name="validUntil"
            label="Valid until"
            description="The code cannot be applied after this date. Leave empty for no expiration."
            boundary="end"
            disabled={isPending}
          />

          <NumberField
            control={form.control}
            name="usageLimit"
            label="Usage limit"
            placeholder="100"
            step={1}
            min={1}
            nullable={true}
            disabled={isPending}
            description="Leave empty for unlimited uses."
          />
        </FieldGroup>
      </FormSection>

      {isEditMode ? (
        <FormSection
          title="Usage"
          description="Read-only information about the code's usage and history."
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Times used</FieldLabel>
              <div className="text-sm font-medium">{entityData.timesUsed}</div>
            </Field>
            <Field>
              <FieldLabel>Created at</FieldLabel>
              <div className="text-sm font-medium">
                {entityData.createdAt ? dateFormatter.format(new Date(entityData.createdAt)) : "-"}
              </div>
            </Field>
            <Field>
              <FieldLabel>Updated at</FieldLabel>
              <div className="text-sm font-medium">
                {entityData.updatedAt ? dateFormatter.format(new Date(entityData.updatedAt)) : "-"}
              </div>
            </Field>
          </FieldGroup>
        </FormSection>
      ) : null}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset(formDefaults)}
          disabled={isPending}
        >
          Reset
        </Button>
        <Button type="submit" form="form-promotion-code" disabled={isPending}>
          {isEditMode ? "Save changes" : "Create promotion code"}
        </Button>
      </div>
    </form>
  );
}
