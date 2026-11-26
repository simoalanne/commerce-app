import { useSearchParams } from "react-router-dom";

import { NavigateDownAction } from "@/components/navigate-down-action";
import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import { formatCents } from "@/lib/money";

export function CustomersPage() {
  const [searchParams] = useSearchParams();
  const customerIdParam = Number(searchParams.get("customerId"));

  return (
    <EntityPage
      list={queryUtils.customers.getAll.queryOptions({ select: (r) => r.body })}
      detail={(id) =>
        queryUtils.customers.getById.queryOptions({
          request: { params: { id } },
          select: (r) => r.body,
        })
      }
      DialogContent={() => <div>Customer form</div>}
      onRowClicked={() => {}}
      columns={() => [
        {
          accessorKey: "id",
          header: "ID",
          cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
        },
        {
          accessorKey: "email",
          header: "Email",
        },
        {
          accessorKey: "fullName",
          header: "Name",
        },
        {
          accessorKey: "latestOrderCity",
          header: "Latest order city",
          cell: ({ row }) => row.original.latestOrderCity ?? "-",
        },
        {
          accessorKey: "orderCount",
          header: "Orders",
        },
        {
          accessorKey: "lifetimeValueCents",
          header: "Lifetime value",
          cell: ({ row }) => formatCents(row.original.lifetimeValueCents),
        },
      ]}
      extraRowActions={(customer) => (
        <NavigateDownAction
          route="/orders"
          queryParams={{
            customerId: customer.id.toString(),
            customerName: customer.fullName,
          }}
          label={`View orders for customer #${customer.id}`}
        />
      )}
      labels={{
        singular: "Customer",
        plural: "Customers",
      }}
      getEntityName={(row) => row.fullName}
      actions={{ create: false, edit: false, delete: false }}
      transformData={(customers) =>
        customerIdParam
          ? customers.filter((customer) => customer.id === customerIdParam)
          : customers
      }
    />
  );
}
