import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import WebhookForm from "@/features/admin/webhooks/WebhookForm";

export default function WebhooksPage() {
  return (
    <EntityPage
      list={queryUtils.webhooks.getAll.queryOptions({ select: (r) => r.body })}
      detail={(id) =>
        queryUtils.webhooks.getById.queryOptions({
          request: { params: { id } },
          select: (r) => r.body,
        })
      }
      remove={queryUtils.webhooks.delete.mutationOptions()}
      DialogContent={WebhookForm}
      labels={{
        singular: "Webhook",
        plural: "Webhooks",
      }}
      getEntityName={(webhook) => `${webhook.event} (${webhook.url})`}
      searchableColumnIds={["event", "url"]}
      initialSorting={[
        {
          id: "id",
          desc: false,
        },
      ]}
      columns={() => [
        {
          accessorKey: "id",
          header: "ID",
          cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
        },
        {
          accessorKey: "event",
          header: "Event",
        },
        {
          accessorKey: "url",
          header: "Destination URL",
          cell: ({ row }) => (
            <span className="block max-w-[520px] truncate text-sm">{row.original.url}</span>
          ),
        },
      ]}
    />
  );
}
