import { NavigateDownAction } from "@/components/navigate-down-action";
import { storefrontTableColumns } from "@/components/storefront-fields";
import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import { useDashboardLocalization } from "@/context/LocalizationContext";
import VendorForm from "@/features/content-management/vendors/VendorForm";

export default function VendorsPage() {
  const { resolveLocalizedValue } = useDashboardLocalization();
  const getLocalizedText = (value: unknown) => {
    const resolvedValue = resolveLocalizedValue(value);
    return typeof resolvedValue === "string" ? resolvedValue : "";
  };
  const getLocalizedTags = (value: unknown) => {
    const resolvedValue = resolveLocalizedValue(value);
    return Array.isArray(resolvedValue) ? resolvedValue : [];
  };

  return (
    <EntityPage
      list={queryUtils.vendors.getAll.queryOptions({ select: (r) => r.body })}
      detail={(id) =>
        queryUtils.vendors.getById.queryOptions({
          request: { params: { id } },
          select: (r) => r.body,
        })
      }
      remove={queryUtils.vendors.delete.mutationOptions()}
      DialogContent={VendorForm}
      actions={{
        create: true,
        edit: true,
        delete: true,
      }}
      labels={{
        singular: "Vendor",
        plural: "Vendors",
      }}
      getEntityName={(vendor) => vendor.name}
      invalidateOnChange={[queryUtils.products.getAll.queryKey()]}
      searchableColumnIds={["name"]}
      columns={() => [
        {
          accessorKey: "id",
          header: "ID",
          cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
        },
        {
          accessorKey: "name",
          header: "Name",
        },
        {
          id: "slogan",
          header: "Slogan",
          cell: ({ row }) => (
            <span className="block max-w-[260px] truncate text-sm">
              {getLocalizedText(row.original.slogan)}
            </span>
          ),
        },
        {
          id: "tags",
          header: "Tags",
          cell: ({ row }) => (
            <span className="block max-w-[260px] truncate text-sm">
              {getLocalizedTags(row.original.tags).join(", ")}
            </span>
          ),
        },
        ...storefrontTableColumns,
      ]}
      extraRowActions={(vendor) => (
        <NavigateDownAction
          route="/products"
          queryParams={{
            vendorId: vendor.id.toString(),
            vendorName: vendor.name,
          }}
          label={`View products for vendor #${vendor.id}`}
        />
      )}
    />
  );
}
