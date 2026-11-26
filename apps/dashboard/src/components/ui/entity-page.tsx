import { IconPencil, IconTrash } from "@tabler/icons-react";
import {
  type QueryKey,
  type UseMutationOptions,
  type UseSuspenseQueryOptions,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

import DeleteEntityDialog from "@/components/forms/delete-entity-dialog";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  type DataTableInstance,
} from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildExportFilenameBase, downloadDataExport } from "@/utils/exportData";

import { AsyncBoundary } from "../async-boundary";
import { EntityFormDialog } from "../forms/entity-form-dialog";

type EntityPageState =
  | { mode: "idle" }
  | { mode: "create" }
  | { mode: "edit"; id: number }
  | { mode: "delete"; target: unknown };

// The page builds the queries and the shell only reads their data, so the
// query function's data, error and key types stay the page's concern.
export type SuspenseOptions<TData> = UseSuspenseQueryOptions<any, any, TData, any>;

export type DeleteOptions = UseMutationOptions<any, any, { params: { id: number } }, any>;

export type EntityDialogContentProps<TDetail> = {
  entityData?: TDetail;
  onSuccess?: () => void;
};

type DialogContentComponent<TDetail> = (props: EntityDialogContentProps<TDetail>) => ReactElement;

type EntityPageActions = Partial<{
  create: boolean;
  edit: boolean;
  delete: boolean;
}>;

type EntityPageRowClickHelpers<TRow> = {
  openDialog: (row: TRow) => void;
};

type EntityPageProps<TRow extends { id: number }, TDetail> = {
  /** e.g. `queryUtils.x.getAll.queryOptions({ select: (r) => r.body })` */
  list: SuspenseOptions<TRow[]>;
  detail: (id: number) => SuspenseOptions<TDetail>;
  /** Without it, rows can't be deleted. */
  remove?: DeleteOptions;
  DialogContent: DialogContentComponent<TDetail>;
  columns: (helpers: {
    edit?: (row: TRow) => void;
    delete?: (row: TRow) => void;
  }) => DataTableColumn<TRow>[];

  labels: {
    singular: string;
    plural: string;
  };

  getEntityName: (row: TRow) => string;

  /** Queries refetched with the list after a change, e.g. another entity's list. */
  invalidateOnChange?: QueryKey[];

  extraRowActions?: (row: TRow) => ReactElement;

  searchableColumnIds?: string[];

  initialSorting?: SortingState;

  transformData?: (rows: TRow[]) => TRow[];

  renderToolbar?: (table: DataTableInstance<TRow>) => ReactNode;
  onDataChanged?: () => void | Promise<void>;

  onRowClicked?: (row: DataTableRow<TRow>, helpers: EntityPageRowClickHelpers<TRow>) => void;

  rowClickOpensDialog?: boolean;

  rowDialogTitle?: string;

  actions?: EntityPageActions;
  dialogContentClassName?: string;
};

export default function EntityPage<TRow extends { id: number }, TDetail>({
  list,
  detail,
  remove,
  DialogContent,
  columns,
  labels,
  getEntityName,
  invalidateOnChange = [],
  extraRowActions,
  searchableColumnIds,
  initialSorting,
  transformData,
  renderToolbar,
  onDataChanged,
  onRowClicked,
  rowClickOpensDialog,
  rowDialogTitle,
  actions,
  dialogContentClassName,
}: EntityPageProps<TRow, TDetail>) {
  const queryClient = useQueryClient();
  const { data: rowData } = useSuspenseQuery(list);
  const resolvedActions = {
    create: actions?.create ?? true,
    edit: actions?.edit ?? true,
    delete: (actions?.delete ?? true) && remove !== undefined,
  };

  const [state, setState] = useState<EntityPageState>({
    mode: "idle",
  });

  const openCreate = () =>
    setState({
      mode: "create",
    });

  const openEdit = (row: TRow) =>
    setState({
      mode: "edit",
      id: row.id,
    });

  const openRowDialog = (row: TRow) => {
    openEdit(row);
  };

  const openDelete = (row: TRow) =>
    setState({
      mode: "delete",
      target: row,
    });

  const close = () =>
    setState({
      mode: "idle",
    });

  const formOpen = state.mode === "create" || state.mode === "edit";

  const editId = state.mode === "edit" ? state.id : undefined;

  const deleteTarget = state.mode === "delete" ? state.target : null;

  const visibleRows = transformData ? transformData(rowData) : rowData;
  const shouldRenderActionColumn =
    resolvedActions.edit || resolvedActions.delete || extraRowActions !== undefined;
  const shouldOpenDialogOnRowClick = rowClickOpensDialog ?? resolvedActions.edit;
  const shouldHandleRowClick = onRowClicked !== undefined || shouldOpenDialogOnRowClick;

  const actionColumn: DataTableColumn<TRow> = {
    id: "actions",

    header: "Actions",

    enableSorting: false,

    enableGlobalFilter: false,

    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        {resolvedActions.edit ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Edit ${labels.singular.toLowerCase()} #${row.original.id}`}
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row.original);
            }}
          >
            <IconPencil className="h-4 w-4" />
          </Button>
        ) : null}
        {resolvedActions.delete ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label={`Delete ${labels.singular.toLowerCase()} #${row.original.id}`}
            onClick={(event) => {
              event.stopPropagation();
              openDelete(row.original);
            }}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        ) : null}
        {extraRowActions?.(row.original)}
      </div>
    ),
  };

  const finalColumns = [
    ...columns({
      edit: resolvedActions.edit ? openEdit : undefined,
      delete: resolvedActions.delete ? openDelete : undefined,
    }),
    ...(shouldRenderActionColumn ? [actionColumn] : []),
  ];

  const handleSuccess = async () => {
    if (state.mode === "edit") {
      const { queryKey } = detail(state.id);
      queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    }

    await Promise.all(
      [list.queryKey, ...invalidateOnChange].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
    await onDataChanged?.();
    close();
  };

  const renderEntityToolbar = (table: DataTableInstance<TRow>) => {
    const exportRows = table
      .getPrePaginatedRowModel()
      .rows.map((row) => row.original as Record<string, unknown>);
    const filenameBase = buildExportFilenameBase(labels.plural);

    return (
      <>
        {renderToolbar?.(table)}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" disabled={exportRows.length === 0}>
              Export Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                downloadDataExport({
                  rows: exportRows,
                  format: "csv",
                  filenameBase,
                })
              }
            >
              As CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                downloadDataExport({
                  rows: exportRows,
                  format: "json",
                  filenameBase,
                })
              }
            >
              As JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {resolvedActions.create ? (
          <Button type="button" onClick={openCreate}>{`Create ${labels.singular}`}</Button>
        ) : null}
      </>
    );
  };

  return (
    <>
      <DataTable
        data={visibleRows}
        columns={finalColumns}
        getRowId={(row) => String(row.id)}
        emptyMessage={`No ${labels.plural.toLowerCase()} found.`}
        onRowClicked={
          shouldHandleRowClick
            ? (row) =>
                onRowClicked
                  ? onRowClicked(row, {
                      openDialog: openRowDialog,
                    })
                  : shouldOpenDialogOnRowClick
                    ? openRowDialog(row.original)
                    : undefined
            : undefined
        }
        searchPlaceholder={`Search ${labels.plural.toLowerCase()}...`}
        searchableColumnIds={searchableColumnIds}
        initialSorting={initialSorting}
        renderToolbar={renderEntityToolbar}
      />
      <EntityFormDialog
        open={formOpen}
        onOpenChange={close}
        title={
          state.mode === "create"
            ? `Create ${labels.singular}`
            : (rowDialogTitle ?? `Edit ${labels.singular}`)
        }
        contentClassName={dialogContentClassName}
      >
        {editId ? (
          <DialogContentLoader
            detail={detail(editId)}
            dialogContent={DialogContent}
            onSuccess={handleSuccess}
          />
        ) : (
          <DialogContent onSuccess={handleSuccess} />
        )}
      </EntityFormDialog>
      {resolvedActions.delete && remove && (
        <DeleteEntityDialog
          remove={remove}
          entityLabel={labels.singular}
          target={deleteTarget as TRow | null}
          onDeleteSuccess={handleSuccess}
          getEntityName={getEntityName}
        />
      )}
    </>
  );
}

type DialogContentLoaderProps<TDetail> = {
  detail: SuspenseOptions<TDetail>;
  onSuccess: () => void;
  dialogContent: DialogContentComponent<TDetail>;
};

const DialogContentLoader = <TDetail,>({
  detail,
  dialogContent: DialogContent,
  onSuccess,
}: DialogContentLoaderProps<TDetail>) => {
  return (
    <AsyncBoundary loadingFallback={<DialogContent />}>
      <DialogContentLoaderContent
        detail={detail}
        dialogContent={DialogContent}
        onSuccess={onSuccess}
      />
    </AsyncBoundary>
  );
};

const DialogContentLoaderContent = <TDetail,>({
  detail,
  dialogContent: DialogContent,
  onSuccess,
}: DialogContentLoaderProps<TDetail>) => {
  const { data } = useSuspenseQuery(detail);

  return <DialogContent entityData={data} onSuccess={onSuccess} />;
};
