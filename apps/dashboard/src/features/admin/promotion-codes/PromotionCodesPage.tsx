import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import PromotionCodeForm from "@/features/admin/promotion-codes/PromotionCodeForm";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const formatDiscount = (promotionCode: { discount_type: string; discount_value: number }) =>
  promotionCode.discount_type.endsWith("PERCENT")
    ? `${promotionCode.discount_value}%`
    : currencyFormatter.format(promotionCode.discount_value);

export default function PromotionCodesPage() {
  return (
    <EntityPage
      list={queryUtils.promotionCodes.getAll.queryOptions({
        select: (r) => r.body,
      })}
      detail={(id) =>
        queryUtils.promotionCodes.getById.queryOptions({
          request: { params: { id } },
          select: (r) => r.body,
        })
      }
      remove={queryUtils.promotionCodes.delete.mutationOptions()}
      DialogContent={PromotionCodeForm}
      labels={{
        singular: "Promotion Code",
        plural: "Promotion Codes",
      }}
      getEntityName={(promotionCode) => promotionCode.code}
      searchableColumnIds={["code"]}
      initialSorting={[
        {
          id: "id",
          desc: true,
        },
      ]}
      columns={() => [
        {
          accessorKey: "id",
          header: "ID",
          cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
        },
        {
          accessorKey: "code",
          header: "Code",
        },
        {
          accessorKey: "is_active",
          header: "Status",
          cell: ({ row }) => (row.original.is_active ? "Active" : "Inactive"),
        },
        {
          id: "discount",
          header: "Discount",
          accessorFn: (row) => `${row.discount_type}:${row.discount_value.toString()}`,
          cell: ({ row }) =>
            `${formatDiscount(row.original)} ${row.original.discount_type.startsWith("ITEMS") ? "items" : "delivery"}`,
        },
        {
          accessorKey: "minimum_items_value",
          header: "Minimum",
          cell: ({ row }) =>
            row.original.minimum_items_value == null
              ? "-"
              : currencyFormatter.format(row.original.minimum_items_value),
        },
        {
          accessorKey: "usage_limit",
          header: "Usage",
          cell: ({ row }) =>
            row.original.usage_limit == null
              ? `${row.original.times_used} / unlimited`
              : `${row.original.times_used} / ${row.original.usage_limit}`,
        },
        {
          accessorKey: "valid_from",
          header: "Starts",
          cell: ({ row }) =>
            row.original.valid_from == null
              ? "-"
              : dateFormatter.format(new Date(row.original.valid_from)),
        },
        {
          accessorKey: "valid_until",
          header: "Ends",
          cell: ({ row }) =>
            row.original.valid_until == null
              ? "-"
              : dateFormatter.format(new Date(row.original.valid_until)),
        },
      ]}
    />
  );
}
