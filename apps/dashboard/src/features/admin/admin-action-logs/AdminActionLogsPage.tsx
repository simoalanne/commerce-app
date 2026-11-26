import type { InferClientResponse } from "@rest-rpc/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { AsyncBoundary } from "@/components/async-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { queryUtils } from "@/context/ApiClientContext";

type AdminActionLogEntry = InferClientResponse<
  typeof queryUtils.adminActionLogs.getAll.fetch
>["body"][number];

const formatDateTime = (date: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

const formatJson = (value: unknown, indent?: number) =>
  value == null ? "-" : JSON.stringify(value, null, indent);

const statusBadgeClassName = (status: number) =>
  status < 400
    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
    : "bg-rose-100 text-rose-800 hover:bg-rose-100";

const columns: DataTableColumn<AdminActionLogEntry>[] = [
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    accessorKey: "adminEmail",
    header: "Admin",
    cell: ({ row }) => (
      <span className="block max-w-[260px] truncate font-medium">
        {row.original.adminEmail ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "route",
    header: "Route",
    cell: ({ row }) => <code className="text-xs whitespace-nowrap">{row.original.route}</code>,
  },
  {
    id: "params",
    header: "Params",
    accessorFn: (row) => formatJson(row.params),
    cell: ({ row }) => (
      <code className="block max-w-[200px] truncate text-xs text-muted-foreground">
        {formatJson(row.original.params)}
      </code>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge className={statusBadgeClassName(row.original.status)}>{row.original.status}</Badge>
    ),
  },
];

export default function AdminActionLogsPage() {
  return (
    <AsyncBoundary>
      <AdminActionLogsContent />
    </AsyncBoundary>
  );
}

function AdminActionLogsContent() {
  const logsQuery = useSuspenseQuery(
    queryUtils.adminActionLogs.getAll.queryOptions({
      select: (r) => r.body,
    }),
  );
  const logs = logsQuery.data;
  const [selectedLog, setSelectedLog] = useState<AdminActionLogEntry | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const openLogDetails = (log: AdminActionLogEntry) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Admin Action Logs</h1>
          <p className="text-sm text-muted-foreground">
            Showing the latest {logs.length} admin actions.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void logsQuery.refetch()}
          disabled={logsQuery.isFetching}
        >
          <RefreshCw className={logsQuery.isFetching ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        getRowId={(log) => String(log.id)}
        searchPlaceholder="Search admin actions"
        searchableColumnIds={["adminEmail", "route", "params"]}
        emptyMessage="No admin action logs found."
        initialSorting={[{ id: "createdAt", desc: true }]}
        initialPageSize={25}
        pageSizeOptions={[25, 50, 100]}
        onRowClicked={(row) => openLogDetails(row.original)}
      />

      <AdminActionLogDetailsDialog
        log={selectedLog}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </div>
  );
}

function AdminActionLogDetailsDialog({
  log,
  open,
  onOpenChange,
}: {
  log: AdminActionLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Admin Action Details</DialogTitle>
        </DialogHeader>
        {log ? (
          <div className="flex flex-col gap-4">
            <LogDetail label="Created">{formatDateTime(log.createdAt)}</LogDetail>
            <LogDetail label="Admin">{log.adminEmail ?? "-"}</LogDetail>
            <LogDetail label="Route">
              <code className="text-sm">{log.route}</code>
            </LogDetail>
            <LogDetail label="Status">
              <Badge className={statusBadgeClassName(log.status)}>{log.status}</Badge>
            </LogDetail>
            {(["params", "body", "result"] as const).map((key) => (
              <LogDetail key={key} label={key[0].toUpperCase() + key.slice(1)}>
                <pre className="max-h-[40vh] overflow-auto rounded-md bg-muted p-3 text-xs break-words whitespace-pre-wrap">
                  {formatJson(log[key], 2)}
                </pre>
              </LogDetail>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LogDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
