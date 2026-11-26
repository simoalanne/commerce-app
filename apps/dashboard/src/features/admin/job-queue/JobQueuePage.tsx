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
import { cn } from "@/lib/utils";

type JobQueueEntry = InferClientResponse<typeof queryUtils.jobQueue.getAll.fetch>["body"][number];

const formatDateTime = (date: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

const formatPayload = (payload: unknown) => {
  if (payload == null) return "-";
  if (typeof payload === "string") return payload;

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const formatPayloadBlock = (payload: unknown) => {
  if (payload == null) return "-";
  if (typeof payload === "string") return payload;

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

const stateBadgeClassName: Record<JobQueueEntry["state"], string> = {
  created: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  retry: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  active: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  completed: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  cancelled: "bg-zinc-100 text-zinc-800 hover:bg-zinc-100",
  failed: "bg-rose-100 text-rose-800 hover:bg-rose-100",
};

const columns: DataTableColumn<JobQueueEntry>[] = [
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <span className="font-medium">{row.original.type}</span>,
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => (
      <Badge className={stateBadgeClassName[row.original.state]}>{row.original.state}</Badge>
    ),
  },
  {
    id: "retries",
    header: "Retries",
    accessorFn: (row) => `${row.retryCount}/${row.retryLimit}`,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.retryCount}/{row.original.retryLimit}
      </span>
    ),
  },
  {
    accessorKey: "startAfter",
    header: "Start after",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.startAfter)}</span>
    ),
  },
  {
    id: "payload",
    header: "Payload",
    accessorFn: (row) => formatPayload(row.payload),
    cell: ({ row }) => (
      <code className="block max-w-[320px] truncate rounded bg-muted px-1.5 py-1 text-xs">
        {formatPayload(row.original.payload)}
      </code>
    ),
  },
  {
    accessorKey: "lastError",
    header: "Last error",
    cell: ({ row }) => (
      <span
        className={cn(
          "block max-w-[360px] truncate text-sm",
          row.original.lastError ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {row.original.lastError ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <code className="block max-w-[120px] truncate text-xs text-muted-foreground">
        {row.original.id}
      </code>
    ),
  },
];

export default function JobQueuePage() {
  return (
    <AsyncBoundary>
      <JobQueueContent />
    </AsyncBoundary>
  );
}

function JobQueueContent() {
  const jobsQuery = useSuspenseQuery(
    queryUtils.jobQueue.getAll.queryOptions({ select: (r) => r.body }),
  );
  const jobs = jobsQuery.data;
  const [selectedJob, setSelectedJob] = useState<JobQueueEntry | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const openJobDetails = (job: JobQueueEntry) => {
    setSelectedJob(job);
    setIsDetailsOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Job Queue</h1>
          <p className="text-sm text-muted-foreground">Showing the latest {jobs.length} jobs.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void jobsQuery.refetch()}
          disabled={jobsQuery.isFetching}
        >
          <RefreshCw className={jobsQuery.isFetching ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      <DataTable
        data={jobs}
        columns={columns}
        getRowId={(job) => job.id}
        searchPlaceholder="Search jobs"
        searchableColumnIds={["type", "state", "retries", "payload", "lastError", "id"]}
        emptyMessage="No jobs found."
        initialSorting={[{ id: "createdAt", desc: true }]}
        initialPageSize={25}
        pageSizeOptions={[25, 50, 100]}
        onRowClicked={(row) => openJobDetails(row.original)}
      />

      <JobDetailsDialog job={selectedJob} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
    </div>
  );
}

function JobDetailsDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobQueueEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Job Details</DialogTitle>
        </DialogHeader>
        {job ? (
          <div className="flex flex-col gap-4">
            <JobDetail label="ID">
              <code className="text-sm break-all">{job.id}</code>
            </JobDetail>
            <JobDetail label="Type">{job.type}</JobDetail>
            <JobDetail label="State">
              <Badge className={stateBadgeClassName[job.state]}>{job.state}</Badge>
            </JobDetail>
            <JobDetail label="Retries">
              {job.retryCount}/{job.retryLimit}
            </JobDetail>
            <JobDetail label="Created">{formatDateTime(job.createdAt)}</JobDetail>
            <JobDetail label="Completed">
              {job.completedAt ? formatDateTime(job.completedAt) : "-"}
            </JobDetail>
            <JobDetail label="Start after">{formatDateTime(job.startAfter)}</JobDetail>
            <JobDetail label="Payload">
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs break-words whitespace-pre-wrap">
                {formatPayloadBlock(job.payload)}
              </pre>
            </JobDetail>
            <JobDetail label="Last error">
              <pre
                className={cn(
                  "max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs break-words whitespace-pre-wrap",
                  job.lastError ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {job.lastError ?? "-"}
              </pre>
            </JobDetail>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function JobDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
