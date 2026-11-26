import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";

import ContactSubmissionDetails from "./ContactSubmissionDetails";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const topicLabel: Record<"CONTACT" | "VENDOR_APPLICATION", string> = {
  CONTACT: "Contact",
  VENDOR_APPLICATION: "Vendor Application",
};

const statusClassName: Record<"OPEN" | "IN_PROGRESS" | "RESOLVED", string> = {
  OPEN: "border-amber-500 text-amber-700",
  IN_PROGRESS: "border-sky-500 text-sky-700",
  RESOLVED: "border-emerald-600 text-emerald-700",
};

export function ContactSubmissionsPage() {
  const [showResolved, setShowResolved] = useState(false);

  return (
    <EntityPage
      list={queryUtils.contactSubmissions.getAll.queryOptions({
        select: (r) => r.body,
      })}
      detail={(id) =>
        queryUtils.contactSubmissions.getById.queryOptions({
          request: { params: { id } },
          select: (r) => r.body,
        })
      }
      DialogContent={ContactSubmissionDetails}
      labels={{
        singular: "Contact Submission",
        plural: "Contact Submissions",
      }}
      getEntityName={(row) => row.name}
      searchableColumnIds={["id", "topic", "name", "email", "phone", "message", "locale", "status"]}
      initialSorting={[{ id: "createdAt", desc: true }]}
      rowDialogTitle="Contact Submission"
      actions={{ create: false, edit: true, delete: false }}
      transformData={(rows) =>
        showResolved ? rows : rows.filter((row) => row.status !== "RESOLVED")
      }
      renderToolbar={() => (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowResolved((current) => !current)}
        >
          {showResolved ? "Hide Resolved" : "Show Resolved"}
        </Button>
      )}
      columns={() => [
        {
          accessorKey: "id",
          header: "ID",
          cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
        },
        {
          accessorKey: "topic",
          header: "Topic",
          cell: ({ row }) => topicLabel[row.original.topic],
        },
        {
          accessorKey: "name",
          header: "Name",
        },
        {
          accessorKey: "email",
          header: "Email",
          cell: ({ row }) => row.original.email ?? "-",
        },
        {
          accessorKey: "phone",
          header: "Phone",
          cell: ({ row }) => row.original.phone ?? "-",
        },
        {
          accessorKey: "locale",
          header: "Locale",
          cell: ({ row }) => row.original.locale.toUpperCase(),
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => (
            <Badge variant="outline" className={statusClassName[row.original.status]}>
              {row.original.status}
            </Badge>
          ),
        },
        {
          id: "createdAt",
          accessorFn: (row) => row.createdAt,
          header: "Submitted At",
          cell: ({ row }) => dateTimeFormatter.format(new Date(row.original.createdAt)),
        },
      ]}
    />
  );
}
