import { type Control, Controller, type FieldValues, type Path } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const storefrontStatusOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export function StorefrontFields<TFormValues extends FieldValues>({
  control,
}: {
  control: Control<TFormValues>;
}) {
  return (
    <FieldGroup className="gap-4">
      <Controller
        name={"storefrontVisibility" as Path<TFormValues>}
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel>Storefront Visibility</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select storefront visibility" />
              </SelectTrigger>
              <SelectContent>
                {storefrontStatusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      <Controller
        name={"isFeatured" as Path<TFormValues>}
        control={control}
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            <FieldContent>
              <FieldLabel>Featured</FieldLabel>
            </FieldContent>
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// untyped because only thing types prevent is someone calling this for an entity that
// doesn't have storefront fields, which is a not a likely scenario and not worth the extra complexity of generics.
export const storefrontTableColumns = [
  {
    accessorKey: "storefrontVisibility",
    header: "Storefront Visibility",
    cell: ({ row }: any) => (
      <Badge
        variant="outline"
        className={
          row.original.storefrontVisibility === "ACTIVE"
            ? "border-green-600 text-green-700"
            : "px-1.5 text-muted-foreground"
        }
      >
        {row.original.storefrontVisibility}
      </Badge>
    ),
  },
  {
    accessorKey: "isFeatured",
    header: "Featured",
    cell: ({ row }: any) =>
      row.original.isFeatured ? (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          Featured
        </Badge>
      ) : (
        <span className="text-muted-foreground">No</span>
      ),
  },
];
