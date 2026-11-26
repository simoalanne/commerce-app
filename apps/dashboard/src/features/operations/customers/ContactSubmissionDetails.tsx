import { ContactSubmissionStatusSchema } from "@acme/shared/schemas/contactSubmissions";
import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntityDialogContentProps } from "@/components/ui/entity-page";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { queryUtils } from "@/context/ApiClientContext";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const topicLabel: Record<"CONTACT" | "VENDOR_APPLICATION", string> = {
  CONTACT: "Contact",
  VENDOR_APPLICATION: "Vendor Application",
};

const statusClassName: Record<"OPEN" | "IN_PROGRESS" | "RESOLVED", string> = {
  OPEN: "border-amber-500 text-amber-700",
  IN_PROGRESS: "border-sky-500 text-sky-700",
  RESOLVED: "border-emerald-600 text-emerald-700",
};

type ContactSubmissionDetailsProps = EntityDialogContentProps<
  InferClientResponse<typeof queryUtils.contactSubmissions.getById.fetch>["body"]
>;

export default function ContactSubmissionDetails({
  entityData,
  onSuccess,
}: ContactSubmissionDetailsProps) {
  const queryClient = useQueryClient();
  const updateStatusMutation = useMutation(
    queryUtils.contactSubmissions.updateStatus.mutationOptions(),
  );
  const [status, setStatus] = useState<"OPEN" | "IN_PROGRESS" | "RESOLVED">(
    entityData?.status ?? "OPEN",
  );

  useEffect(() => {
    if (entityData) {
      setStatus(entityData.status);
    }
  }, [entityData]);

  if (!entityData) {
    return <div className="py-8 text-sm text-muted-foreground">Loading contact submission...</div>;
  }

  const hasChanges = status !== entityData.status;

  const saveStatus = () => {
    if (!hasChanges) {
      return;
    }

    updateStatusMutation.mutate(
      {
        params: { id: entityData.id },
        body: { status },
      },
      {
        onSuccess() {
          toast.success("Contact submission updated");
          queryClient.invalidateQueries({
            queryKey: queryUtils.contactSubmissions.getAll.queryKey(),
          });
          onSuccess?.();
        },
        onError(error) {
          toast.error(`Failed to update contact submission: ${error.message}`);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Submission #{entityData.id}</h3>
              <Badge variant="outline" className={statusClassName[entityData.status]}>
                {entityData.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Submitted {dateTimeFormatter.format(new Date(entityData.createdAt))}
            </p>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 sm:text-right">
            <DetailField label="Topic" value={topicLabel[entityData.topic]} />
            <DetailField label="Locale" value={entityData.locale.toUpperCase()} />
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Name" value={entityData.name} />
          <DetailField label="Email" value={entityData.email ?? "-"} />
          <DetailField label="Phone" value={entityData.phone ?? "-"} />
          <DetailField
            label="Last Updated"
            value={dateTimeFormatter.format(new Date(entityData.updatedAt))}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Message</div>
          <div className="rounded-lg border bg-background p-3 text-sm whitespace-pre-wrap">
            {entityData.message}
          </div>
        </div>
      </div>

      <Field>
        <FieldLabel>Status</FieldLabel>
        <Select
          value={status}
          onValueChange={(value) => setStatus(ContactSubmissionStatusSchema.parse(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {ContactSubmissionStatusSchema.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStatus(entityData.status)}
          disabled={!hasChanges || updateStatusMutation.isPending}
        >
          Reset
        </Button>
        <Button
          type="button"
          onClick={saveStatus}
          disabled={!hasChanges || updateStatusMutation.isPending}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}
