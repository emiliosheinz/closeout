"use client";

import {
  type ColumnDef,
  createPaginatedRowModel,
  createSortedRowModel,
  functionalUpdate,
  type ReactTable,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  lastPage,
  PAGE_SIZE,
  type TableSort,
} from "@/shared/lib/table-url-state";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

type DataTableFeatures = typeof features;

export type DataTableInstance<TData extends RowData> = ReactTable<
  DataTableFeatures,
  TData
>;

export type DataTableColumns<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData
>[];

/**
 * A table instance with client-side sorting and pagination over `data`.
 * Sort and page are controlled, so callers can keep them in the URL. Sort
 * headers only toggle between ascending and descending (`sort: null` shows no
 * column as sorted), and changing the data never moves the page. A page past
 * the end shows the last page. `getRowId` keys each row, so a row keeps its
 * DOM and state when the rows reorder.
 */
export function useDataTable<
  TData extends RowData,
  Column extends string = string,
>({
  data,
  columns,
  getRowId,
  sort,
  onSortChange,
  page,
  onPageChange,
}: {
  data: TData[];
  columns: DataTableColumns<TData>;
  getRowId: (row: TData) => string;
  sort: TableSort<Column> | null;
  onSortChange: (sort: TableSort<Column> | null) => void;
  /** 1-based; clamped to the pages there are. */
  page: number;
  onPageChange: (page: number) => void;
}): DataTableInstance<TData> {
  const sorting = sort
    ? [{ id: sort.column, desc: sort.direction === "desc" }]
    : [];
  const pagination = {
    pageIndex: Math.max(1, Math.min(page, lastPage(data.length))) - 1,
    pageSize: PAGE_SIZE,
  };

  return useTable({
    features,
    data,
    columns,
    getRowId,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0];
      onSortChange(
        next
          ? { column: next.id as Column, direction: next.desc ? "desc" : "asc" }
          : null,
      );
    },
    onPaginationChange: (updater) => {
      onPageChange(functionalUpdate(updater, pagination).pageIndex + 1);
    },
    enableSortingRemoval: false,
    sortDescFirst: false,
    autoResetPageIndex: false,
  });
}

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

/**
 * Renders a table instance in a card; `empty` is shown instead of rows when
 * none match. `className` goes on the outer box, so it can restyle the cells.
 */
export function DataTable<TData extends RowData>({
  table,
  empty,
  className,
}: {
  table: DataTableInstance<TData>;
  empty: React.ReactNode;
  className?: string;
}) {
  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const pageNumber = table.state.pagination.pageIndex + 1;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Edge cells take the inset instead of the card, so row lines and the
          hover band run to the card's edges. */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface [&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        canSort
                          ? sorted
                            ? ARIA_SORT[sorted]
                            : "none"
                          : undefined
                      }
                    >
                      {canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-sm hover:text-ink"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden>
                            {sorted === "asc"
                              ? "↑"
                              : sorted === "desc"
                                ? "↓"
                                : ""}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length}>
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Página anterior
          </Button>
          <span className="text-sm">
            Página {pageNumber} de {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Próxima página
          </Button>
        </div>
      )}
    </div>
  );
}
