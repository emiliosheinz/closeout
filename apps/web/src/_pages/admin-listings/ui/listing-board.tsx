"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { parseAsString } from "nuqs";
import { useState } from "react";
import {
  type AdminListingSummary,
  findStatusFilter,
  ListingTitle,
  listingReads,
  STATUS_FILTERS,
  tabCounts,
} from "@/entities/listing";
import {
  ListingRowActions,
  ListingStatusControls,
  useListings,
} from "@/features/listing-actions";
import { readQuery } from "@/shared/api";
import { formatPrice, formatShortDate } from "@/shared/lib/format";
import {
  createTableUrlState,
  useTableUrlState,
} from "@/shared/lib/table-url-state";
import { compareText, matchesSearch } from "@/shared/lib/text";
import { cn } from "@/shared/lib/utils";
import {
  DataTable,
  type DataTableColumns,
  useDataTable,
} from "@/shared/ui/data-table/data-table";
import { SearchInput } from "@/shared/ui/search-input";

const listingsTable = createTableUrlState({
  prefix: "",
  sorts: ["titulo", "preco", "atualizado"],
  defaultSort: { column: "atualizado", direction: "desc" },
});

const statusParser = { status: parseAsString.withDefault("") };

/**
 * One table row and what its cells need. `sortAs` is the listing as it was
 * when pinned, so a pinned row keeps its place.
 */
type Row = {
  listing: AdminListingSummary;
  sortAs: AdminListingSummary;
  storeId: string;
  storeSlug: string;
  unreachableSellerIds: string[];
  onStatusChange: (id: string) => void;
};

// Cells render as components, so the columns live outside the board: a new
// cell function on every render would remount the row's controls.
const columns: DataTableColumns<Row> = [
  {
    id: "titulo",
    header: "Título",
    accessorFn: (row) => row.sortAs.title,
    sortFn: (a, b, id) =>
      compareText(a.getValue<string>(id), b.getValue<string>(id)),
    cell: ({ row }) => (
      <ListingTitle
        listing={row.original.listing}
        unreachableSellerIds={row.original.unreachableSellerIds}
      />
    ),
  },
  {
    id: "preco",
    header: "Preço",
    // "Preço a combinar" (no price) goes last in both directions.
    accessorFn: (row) => row.sortAs.priceCents ?? undefined,
    sortUndefined: "last",
    sortFn: (a, b, id) => a.getValue<number>(id) - b.getValue<number>(id),
    cell: ({ row }) => (
      <span className="font-semibold whitespace-nowrap text-ink-soft">
        {formatPrice(row.original.listing.priceCents)}
      </span>
    ),
  },
  {
    id: "atualizado",
    header: "Atualizado",
    accessorFn: (row) => row.sortAs.updatedAt,
    sortFn: (a, b, id) =>
      Date.parse(a.getValue<string>(id)) - Date.parse(b.getValue<string>(id)),
    cell: ({ row }) => (
      <span className="text-sm whitespace-nowrap text-muted">
        {formatShortDate(row.original.listing.updatedAt)}
      </span>
    ),
  },
  {
    id: "situacao",
    header: "Situação",
    enableSorting: false,
    cell: ({ row }) => (
      <ListingStatusControls
        storeId={row.original.storeId}
        listing={row.original.listing}
        onStatusChange={row.original.onStatusChange}
      />
    ),
  },
  {
    id: "acoes",
    header: "Ações",
    enableSorting: false,
    cell: ({ row }) => (
      <ListingRowActions
        storeId={row.original.storeId}
        storeSlug={row.original.storeSlug}
        listing={row.original.listing}
      />
    ),
  },
];

const tab = (active: boolean) =>
  cn(
    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
    active
      ? "bg-ink text-surface"
      : "border border-line bg-surface text-ink-soft hover:border-ink/40",
  );

// Below lg the table reflows into one card per row: the sort headers wrap
// into a row of buttons and each row's cells stack, so nothing scrolls sideways.
// The 2nd and 3rd cells (price, last update) share a line, so this depends on
// the order of `columns`.
const reflow = cn(
  "max-lg:[&_table]:block max-lg:[&_thead]:block max-lg:[&_tbody]:block",
  "max-lg:[&_thead_tr]:flex max-lg:[&_thead_tr]:flex-wrap max-lg:[&_th:not([aria-sort])]:hidden",
  "max-lg:[&_tbody_tr]:grid max-lg:[&_tbody_tr]:grid-cols-2 max-lg:[&_tbody_tr]:gap-x-4 max-lg:[&_tbody_tr]:py-2",
  "max-lg:[&_td]:col-span-2 max-lg:[&_td:nth-child(2)]:col-span-1 max-lg:[&_td:nth-child(3)]:col-span-1",
  // Rows are boxes here, so the row takes the card inset instead of its edge cells.
  "max-lg:[&_tr]:px-2 max-lg:[&_tr>*:first-child]:pl-2 max-lg:[&_tr>*:last-child]:pr-2 max-lg:[&_th]:content-center",
);

const NO_PINS = new Map<string, AdminListingSummary>();

function StatusTab({
  active,
  label,
  count,
  testId,
  onSelect,
}: {
  active: boolean;
  label: string;
  count: number;
  testId?: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={tab(active)}
        aria-pressed={active}
      >
        {label}
        <span
          className={active ? "text-surface/70" : "text-muted"}
          data-testid={testId}
        >
          {count}
        </span>
      </button>
    </li>
  );
}

/**
 * Status tabs, search and the listings table, all read from the listings
 * cache so a status change moves the counts at once. The view lives in the
 * URL. Rows whose status changed are pinned: they stay listed in their place
 * under the active tab, refetches included, until the view changes from
 * anywhere (a control here or a link that only changes the URL).
 */
export function ListingBoard({
  storeId,
  storeSlug,
}: {
  storeId: string;
  storeSlug: string;
}) {
  const listings = useListings(storeId);
  const { data: sellers } = useSuspenseQuery(
    readQuery(listingReads.sellers(storeId)),
  );
  const [view, setView] = useTableUrlState(listingsTable, statusParser);
  const status = findStatusFilter(view.status);
  const q = view.query.trim();
  const viewKey = JSON.stringify([status?.slug, q, view.sort, view.page]);
  // Pins belong to the view they were made in. Leaving it forgets them, so
  // coming back to the same view does not bring them back.
  const [pinned, setPinned] = useState({ viewKey, ids: NO_PINS });
  if (pinned.viewKey !== viewKey) setPinned({ viewKey, ids: NO_PINS });
  const pins = pinned.viewKey === viewKey ? pinned.ids : NO_PINS;
  const counts = tabCounts(listings);
  const unreachableSellerIds = sellers.items
    .filter((seller) => !seller.whatsappNumber)
    .map((seller) => seller.id);

  function pin(id: string) {
    const listing = listings.find((candidate) => candidate.id === id);
    if (!listing || pins.has(id)) return;
    setPinned({ viewKey, ids: new Map(pins).set(id, listing) });
  }

  const rows: Row[] = listings
    .filter(
      (listing) =>
        (!status || status.matches(listing) || pins.has(listing.id)) &&
        matchesSearch(listing.title, q),
    )
    .map((listing) => ({
      listing,
      sortAs: pins.get(listing.id) ?? listing,
      storeId,
      storeSlug,
      unreachableSellerIds,
      onStatusChange: pin,
    }));

  const table = useDataTable({
    data: rows,
    columns,
    getRowId: (row) => row.listing.id,
    sort: view.sort,
    onSortChange: (sort) => setView({ sort }),
    page: view.page,
    onPageChange: (page) => setView({ page }),
  });

  return (
    <>
      <fieldset className="-mx-4 mt-4.5 -mb-1.5 min-w-0 overflow-x-auto px-4 py-1.5 scrollbar-none sm:-mx-1.5 sm:px-1.5">
        <legend className="sr-only">Filtrar por situação</legend>
        <ul className="flex gap-2">
          <StatusTab
            active={status === null}
            label="Todos"
            count={listings.length}
            onSelect={() => setView({ status: "" })}
          />
          {STATUS_FILTERS.map((filter) => (
            <StatusTab
              key={filter.slug}
              active={status?.slug === filter.slug}
              label={filter.label}
              count={counts[filter.count]}
              testId={`count-${filter.count}`}
              onSelect={() => setView({ status: filter.slug })}
            />
          ))}
        </ul>
      </fieldset>

      <SearchInput
        id="admin-search"
        label="Buscar anúncios pelo título"
        placeholder="Buscar pelo título"
        value={view.query}
        onChange={(query) => setView({ query })}
        className="mt-6"
      />

      <DataTable
        table={table}
        className={cn("mt-4", reflow)}
        empty={
          <p className="px-4 py-8 text-center text-ink-soft">
            {q
              ? `Nenhum anúncio${status ? ` em ${status.label}` : ""} com "${q}" no título.`
              : status
                ? `Nenhum anúncio em ${status.label}.`
                : "Nenhum anúncio ainda. Comece pelo botão Novo anúncio."}
          </p>
        }
      />
    </>
  );
}
