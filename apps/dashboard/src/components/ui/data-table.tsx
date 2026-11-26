import {
  type ColumnDef,
  type ColumnFiltersState,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  type FilterFn,
  flexRender,
  globalFilteringFeature,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  type Table as TableInstance,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dataTableFeatures = tableFeatures({
  rowSelectionFeature,
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  // The sort functions v8 bundled; "auto" sorting picks between these.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

type DataTableFeatures = typeof dataTableFeatures;
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;
export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>;
export type DataTableInstance<TData extends RowData> = TableInstance<DataTableFeatures, TData>;

type DataTableProps<TData extends RowData> = {
  data: TData[];
  columns: DataTableColumn<TData>[];
  getRowId?: (row: TData, index: number) => string;
  emptyMessage?: string;
  onRowClicked?: (row: DataTableRow<TData>) => void;
  searchPlaceholder?: string;
  searchableColumnIds?: string[];
  showSearch?: boolean;
  initialSorting?: SortingState;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  showPagination?: boolean;
  renderToolbar?: (table: DataTableInstance<TData>) => ReactNode;
  rowSelection?: {
    enabled?: boolean;
    canSelectRow?: (row: DataTableRow<TData>) => boolean;
    renderActions?: (args: {
      selectedRows: DataTableRow<TData>[];
      clearSelection: () => void;
      table: DataTableInstance<TData>;
    }) => ReactNode;
  };
};

export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  emptyMessage = "No results.",
  onRowClicked,
  searchPlaceholder,
  searchableColumnIds,
  showSearch = true,
  initialSorting = [],
  initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  showPagination = true,
  renderToolbar,
  rowSelection,
}: DataTableProps<TData>) {
  const [selectedRowsState, setSelectedRowsState] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const selectionEnabled = rowSelection?.enabled ?? false;

  const globalFilterFn: FilterFn<DataTableFeatures, TData> = (row, _columnId, filterValue) => {
    const query = String(filterValue ?? "")
      .trim()
      .toLowerCase();
    if (!query) {
      return true;
    }

    const searchableColumns = searchableColumnIds?.length
      ? searchableColumnIds
      : row
          .getAllCells()
          .map((cell) => cell.column.id)
          .filter((columnId) => columnId !== "actions" && columnId !== "__select");

    return searchableColumns.some((columnId) => {
      const value = row.getValue(columnId);
      return String(value ?? "")
        .toLowerCase()
        .includes(query);
    });
  };

  const selectionColumn: DataTableColumn<TData> = {
    id: "__select",
    header: ({ table }) => (
      <div className="flex items-center">
        <Checkbox
          aria-label="Select all rows"
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center">
        <Checkbox
          aria-label={`Select row ${row.id}`}
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
        />
      </div>
    ),
    enableSorting: false,
    enableGlobalFilter: false,
  };

  const finalColumns = selectionEnabled ? [selectionColumn, ...columns] : columns;

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [sorting, columnFilters, globalFilter, data]);

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: finalColumns,
    state: {
      rowSelection: selectedRowsState,
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    getRowId: getRowId ?? ((_, index) => String(index)),
    enableRowSelection: rowSelection?.canSelectRow ?? selectionEnabled,
    onRowSelectionChange: setSelectedRowsState,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn,
  });
  const selectedRows = table.getSelectedRowModel().rows;
  const clearSelection = () => setSelectedRowsState({});
  const bulkActions = rowSelection?.renderActions?.({
    selectedRows,
    clearSelection,
    table,
  });
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;
  const pageStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = totalRows === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, totalRows);
  const pageWindowStart = Math.max(0, pageIndex - 2);
  const pageNumbers = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => pageWindowStart + index + 1,
  ).filter((pageNumber) => pageNumber <= pageCount);

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-2 sm:px-4 lg:px-6">
      {(showSearch && searchPlaceholder) || renderToolbar || bulkActions ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {showSearch && searchPlaceholder ? (
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              className="max-w-sm"
            />
          ) : (
            <div />
          )}
          {renderToolbar || bulkActions ? (
            <div className="flex flex-wrap items-center gap-2">
              {renderToolbar?.(table)}
              {selectedRows.length > 0 ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedRows.length} selected
                  </span>
                  {bulkActions}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-4" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-4" />
                          ) : (
                            <ArrowUpDown className="size-4" />
                          )}
                        </Button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClicked ? "cursor-pointer" : undefined}
                  onClick={() => onRowClicked?.(row)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={
                        cell.column.id === "__select"
                          ? (event) => event.stopPropagation()
                          : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showPagination ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            {`Showing ${pageStart}-${pageEnd} from ${totalRows}`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows</span>
              <select
                value={pageSize}
                onChange={(event) => table.setPageSize(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            {pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                variant={pageNumber === pageIndex + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => table.setPageIndex(pageNumber - 1)}
              >
                {pageNumber}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
