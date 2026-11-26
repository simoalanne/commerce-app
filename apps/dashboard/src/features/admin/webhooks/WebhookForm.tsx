import { WebhookSubscriptionFormSchema as formSchema } from "@acme/shared/schemas/webhooks";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { Button } from "@/components/ui/button";
import type { EntityDialogContentProps } from "@/components/ui/entity-page";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { queryUtils } from "@/context/ApiClientContext";

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

type Webhook = InferClientResponse<typeof queryUtils.webhooks.getById.fetch>["body"];

type WebhookFormProps = EntityDialogContentProps<Webhook>;

export default function WebhookForm({ entityData, onSuccess }: WebhookFormProps) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(queryUtils.webhooks.create.mutationOptions());
  const updateMutation = useMutation(queryUtils.webhooks.update.mutationOptions());

  const fallbackDefaults: FormOutput = {
    event: "",
    url: "",
  };

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: entityData ?? fallbackDefaults,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit((data) => {
    if (entityData) {
      updateMutation.mutate(
        { params: { id: entityData.id }, body: data },
        {
          onSuccess() {
            toast.success("Webhook updated");
            queryClient.invalidateQueries({
              queryKey: queryUtils.webhooks.getAll.queryKey(),
            });
            onSuccess?.();
          },
          onError(error) {
            toast.error(`Failed to update webhook: ${error.message}`);
          },
        },
      );
      return;
    }

    createMutation.mutate(
      { body: data },
      {
        onSuccess() {
          toast.success("Webhook created");
          queryClient.invalidateQueries({
            queryKey: queryUtils.webhooks.getAll.queryKey(),
          });
          form.reset();
          onSuccess?.();
        },
        onError(error) {
          toast.error(`Failed to create webhook: ${error.message}`);
        },
      },
    );
  });

  return (
    <form id="form-webhook" onSubmit={onSubmit}>
      <FieldGroup>
        <Controller
          name="event"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="webhook-event">Event</FieldLabel>
              <Input
                {...field}
                id="webhook-event"
                placeholder="order.paid"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Controller
          name="url"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="webhook-url">Destination URL</FieldLabel>
              <Input
                {...field}
                id="webhook-url"
                placeholder="https://example.com/webhooks/order-paid"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isPending}>
          Reset
        </Button>
        <Button type="submit" form="form-webhook" disabled={isPending}>
          {entityData ? "Update Webhook" : "Create Webhook"}
        </Button>
      </div>
    </form>
  );
}
