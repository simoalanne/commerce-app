import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import { CategoryForm } from "@/features/content-management/categories/CategoryForm";

export default function CategoriesPage() {
  return (
    <EntityPage
      list={queryUtils.categories.getAll.queryOptions({ select: (r) => r.body })}
      detail={(id) =>
        queryUtils.categories.getById.queryOptions({
          request: { params: { id } },
          select: (r) => r.body,
        })
      }
      remove={queryUtils.categories.delete.mutationOptions()}
      DialogContent={CategoryForm}
      labels={{
        singular: "Category",
        plural: "Categories",
      }}
      getEntityName={(category) => category.name}
      searchableColumnIds={["name"]}
      initialSorting={[
        {
          id: "name",
          desc: false,
        },
      ]}
      invalidateOnChange={[queryUtils.categories.getProductMarkupDefaults.queryKey()]}
      columns={() => [
        {
          accessorKey: "id",
          header: "ID",
          cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
        },
        {
          id: "name",
          accessorFn: (row) => row.name,
          header: "Name",
          cell: ({ row }) => row.original.name,
        },
        {
          accessorKey: "markup_percent",
          header: "Product Markup",
          cell: ({ row }) =>
            row.original.markup_percent == null ? "Not set" : `${row.original.markup_percent}%`,
        },
      ]}
    />
  );
}
