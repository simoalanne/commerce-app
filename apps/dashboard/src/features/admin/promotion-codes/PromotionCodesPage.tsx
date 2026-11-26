import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import PromotionCodeForm from "@/features/admin/promotion-codes/PromotionCodeForm";
import { formatCents } from "@/lib/money";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const formatDiscount = (promotionCode: { discountType: string; discountValue: number }) =>
  promotionCode.discountType.endsWith("PERCENT")
    ? `${promotionCode.discountValue}%`
    : formatCents(promotionCode.discountValue);

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
          accessorKey: "isActive",
          header: "Status",
          cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive"),
        },
        {
          id: "discount",
          header: "Discount",
          accessorFn: (row) => `${row.discountType}:${row.discountValue.toString()}`,
          cell: ({ row }) =>
            `${formatDiscount(row.original)} ${row.original.discountType.startsWith("ITEMS") ? "items" : "delivery"}`,
        },
        {
          accessorKey: "minimumItemsValueCents",
          header: "Minimum",
          cell: ({ row }) =>
            row.original.minimumItemsValueCents == null
              ? "-"
              : formatCents(row.original.minimumItemsValueCents),
        },
        {
          accessorKey: "usageLimit",
          header: "Usage",
          cell: ({ row }) =>
            row.original.usageLimit == null
              ? `${row.original.timesUsed} / unlimited`
              : `${row.original.timesUsed} / ${row.original.usageLimit}`,
        },
        {
          accessorKey: "validFrom",
          header: "Starts",
          cell: ({ row }) =>
            row.original.validFrom == null
              ? "-"
              : dateFormatter.format(new Date(row.original.validFrom)),
        },
        {
          accessorKey: "validUntil",
          header: "Ends",
          cell: ({ row }) =>
            row.original.validUntil == null
              ? "-"
              : dateFormatter.format(new Date(row.original.validUntil)),
        },
      ]}
    />
  );
}
