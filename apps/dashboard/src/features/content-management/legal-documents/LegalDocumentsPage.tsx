"use client";

import {
  type LegalDocumentKeySchema,
  LegalDocumentUpsertSchema,
} from "@acme/shared/schemas/legalDocuments";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

import { ContentLocaleFlag, contentLocaleLabels } from "@/components/ContentLocaleFlag";
import { FormTextField } from "@/components/forms";
import { MDXEditorControlled } from "@/components/forms/MDXEditorControlled.tsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { queryUtils } from "@/context/ApiClientContext";
import { useDashboardLocalization } from "@/context/LocalizationContext";

import "@mdxeditor/editor/style.css";

const LegalDocumentEditorSchema = LegalDocumentUpsertSchema.omit({
  key: true,
});

type LegalDocumentKey = z.infer<typeof LegalDocumentKeySchema>;
type LegalDocumentFormValues = z.input<typeof LegalDocumentEditorSchema>;

type LegalDocumentConfig = {
  key: LegalDocumentKey;
  title: string;
  description: string;
};

const legalDocuments: LegalDocumentConfig[] = [
  {
    key: "ORDER_AND_DELIVERY_TERMS",
    title: "Order and delivery terms",
    description: "The main checkout document customers accept when they place an order.",
  },
  {
    key: "RETURNS_AND_CANCELLATION",
    title: "Returns and cancellation",
    description: "A focused explanation of returns, refunds, and cancellation rights.",
  },
  {
    key: "PRIVACY_NOTICE",
    title: "Privacy notice",
    description: "How customer and account data is collected, processed, and retained.",
  },
  {
    key: "CONTACT_INFORMATION",
    title: "Contact information",
    description: "The canonical business contact page linked from checkout and footer areas.",
  },
];

export default function LegalDocumentsPage() {
  const { contentLocale } = useDashboardLocalization();

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <ContentLocaleFlag locale={contentLocale} />
            </div>
            <p className="text-sm text-muted-foreground">
              This page contains the documents that{" "}
              <strong className="font-bold">MUST EXIST</strong> in order for the store to operate in
              a legally compliant way. More documents may be added in the future but these should be
              the minimum required. Swap the language in profile settings to fill out other locales
              than just {contentLocaleLabels[contentLocale]}.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {legalDocuments.map((document) => (
              <LegalDocumentCard key={document.key} document={document} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegalDocumentCard({ document }: { document: LegalDocumentConfig }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const { data, isLoading } = useQuery(
    queryUtils.legalDocuments.get.queryOptions({
      request: { query: { key: document.key } },
      select: (r) => r.body,
    }),
  );

  return (
    <>
      <Card className="justify-between">
        <CardHeader>
          <CardTitle>{document.title}</CardTitle>
          <CardDescription>{document.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Status
            </p>
            <p className="text-sm">{isLoading ? "Loading" : data ? "Created" : "Not created"}</p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Current title
            </p>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : data?.title || "No document content available yet."}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="button" className="w-full" onClick={() => setEditorOpen(true)}>
            {data ? "Edit document" : "Create document"}
          </Button>
        </CardFooter>
      </Card>

      <LegalDocumentEditorDialog
        document={document}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </>
  );
}

function LegalDocumentEditorDialog({
  document,
  open,
  onOpenChange,
}: {
  document: LegalDocumentConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { contentLocale } = useDashboardLocalization();
  const { data, isLoading } = useQuery(
    queryUtils.legalDocuments.get.queryOptions({
      request: { query: { key: document.key } },
      select: (r) => r.body,
      enabled: open,
    }),
  );
  const upsertMutation = useMutation(queryUtils.legalDocuments.upsert.mutationOptions());
  const form = useForm<LegalDocumentFormValues>({
    resolver: zodResolver(LegalDocumentEditorSchema),
    defaultValues: {
      title: "",
      content: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      title: data?.title ?? "",
      content: data?.content ?? "",
    });
  }, [data, form, open]);

  const onSubmit = form.handleSubmit(
    (values) => {
      upsertMutation.mutate(
        {
          body: {
            key: document.key,
            ...values,
          },
        },
        {
          onSuccess({ body: savedDocument }) {
            toast.success(`${document.title} saved`);
            form.reset({
              title: savedDocument.title,
              content: savedDocument.content,
            });
            void queryClient.invalidateQueries({
              queryKey: queryUtils.legalDocuments.get.queryKey({
                query: { key: document.key },
              }),
            });
            onOpenChange(false);
          },
          onError(error) {
            toast.error(`Failed to save ${document.title}: ${error.message}`);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
          <DialogDescription>
            Editing content for {contentLocale.toUpperCase()}. Add or update the selected language
            version of this document here.
          </DialogDescription>
        </DialogHeader>

        <form id={`legal-document-${document.key}`} onSubmit={onSubmit} className="space-y-6">
          <FieldGroup>
            <FormTextField
              name="title"
              control={form.control}
              label="Title"
              placeholder={`Document title in ${contentLocale.toUpperCase()}`}
              disabled={isLoading || upsertMutation.isPending}
            />

            <Controller
              name="content"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Content</FieldLabel>
                  <MDXEditorControlled
                    value={
                      (field.value as string) ??
                      `Document content in ${contentLocale.toUpperCase()}`
                    }
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              form.reset({
                title: data?.title ?? "",
                content: data?.content ?? "",
              })
            }
            disabled={isLoading || upsertMutation.isPending}
          >
            Reset
          </Button>
          <Button
            type="submit"
            form={`legal-document-${document.key}`}
            disabled={isLoading || upsertMutation.isPending}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
