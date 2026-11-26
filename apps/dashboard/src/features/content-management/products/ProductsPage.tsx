import { useSearchParams } from "react-router-dom";

import { storefrontTableColumns } from "@/components/storefront-fields";
import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import { useDashboardLocalization } from "@/context/LocalizationContext";
import ProductForm from "@/features/content-management/products/ProductForm";
import { formatCents } from "@/lib/money";

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const { resolveLocalizedValue } = useDashboardLocalization();
  const vendorIdParam = Number(searchParams.get("vendorId"));
  const getProductName = (value: unknown) => {
    const resolvedValue = resolveLocalizedValue(value);
    return typeof resolvedValue === "string" ? resolvedValue : "";
  };

  return (
    <EntityPage
      list={queryUtils.products.getAll.queryOptions({ select: (r) => r.body })}
      detail={(id) =>
        queryUtils.products.getById.queryOptions({
          request: { params: { id } },
          select: (r) => r.body,
        })
      }
      remove={queryUtils.products.delete.mutationOptions()}
      DialogContent={ProductForm}
      labels={{
        singular: "Product",
        plural: "Products",
      }}
      getEntityName={(product) => getProductName(product.name)}
      searchableColumnIds={["name"]}
      initialSorting={[
        {
          id: "id",
          desc: true,
        },
      ]}
      transformData={(products) =>
        vendorIdParam ? products.filter((product) => product.vendorId === vendorIdParam) : products
      }
      columns={() => [
        {
          accessorKey: "id",
          header: "ID",
          cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
        },
        {
          accessorKey: "vendorId",
          header: "Vendor ID",
        },
        {
          id: "name",
          accessorFn: (row) => `${getProductName(row.name)} ${row.sku}`.trim(),
          header: "Name",
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span>{getProductName(row.original.name)}</span>
              <span className="text-xs text-muted-foreground">{row.original.sku}</span>
            </div>
          ),
        },
        {
          accessorKey: "sales_price",
          header: "Sales Price",
          cell: ({ row }) => formatCents(row.original.salesPriceCents),
        },
        {
          accessorKey: "currentStock",
          header: "Stock",
          cell: ({ row }) => row.original.currentStock,
        },
        {
          accessorKey: "purchaseLimitPerOrder",
          header: "Limit",
          cell: ({ row }) =>
            row.original.purchaseLimitPerOrder > 0 ? row.original.purchaseLimitPerOrder : "None",
        },
        ...storefrontTableColumns,
        {
          id: "image_count",
          accessorFn: (row) => row.images.length,
          header: "Images",
          cell: ({ row }) => row.original.images.length,
        },
      ]}
    />
  );
}
