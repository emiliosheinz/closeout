"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BuyerContact, type BuyerSummary, buyerReads } from "@/entities/buyer";
import { displayNumber } from "@/entities/member";
import { BuyerActions } from "@/features/buyer-actions";
import { readQuery } from "@/shared/api";
import {
  AVAILABILITY_LABELS,
  formatMoney,
  PAYMENT_LABELS,
} from "@/shared/lib/format";
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

const urlState = createTableUrlState({
  prefix: "buyers-",
  sorts: ["name", "owed"],
  defaultSort: { column: "owed", direction: "desc" },
});

// The actions menu is the last column and takes only its button's width. On
// phones the first column takes all the room left and wraps its content there
// instead of widening the table (max-w-0 lets a cell shrink below its content).
const columnWidths =
  "[&_tr>*:last-child]:w-px [&_tr>*:last-child]:text-right [&_th:nth-child(2)]:text-right [&_td:nth-child(2)]:text-right max-sm:[&_td:first-child]:w-full max-sm:[&_td:first-child]:max-w-0";

const pill = "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold";

type BuyerRow = { buyer: BuyerSummary; storeId: string; seller: boolean };

function focusHeading() {
  document.getElementById("buyers-heading")?.focus();
}

function ItemLine({ item }: { item: BuyerSummary["items"][number] }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <Link
        href={`/admin/listings/${item.listingId}`}
        className="min-w-0 max-w-full truncate font-medium hover:underline"
      >
        {item.title}
      </Link>
      <span className={cn(pill, "bg-ink/5 text-ink-soft")}>
        {AVAILABILITY_LABELS[item.availability]}
      </span>
      <span className="text-ink-soft">
        {item.agreedPriceCents === null
          ? "Sem preço"
          : formatMoney(item.agreedPriceCents)}
      </span>
      <span
        className={cn(
          pill,
          item.paid ? "bg-ink/5 text-ink-soft" : "bg-stamp/10 text-stamp",
        )}
      >
        {item.paid ? PAYMENT_LABELS.paid : PAYMENT_LABELS.unpaid}
      </span>
    </li>
  );
}

function BuyerCell({
  buyer,
  seller,
}: {
  buyer: BuyerSummary;
  seller: boolean;
}) {
  return (
    <div className="min-w-0 py-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <BuyerContact buyer={buyer} />
        {buyer.whatsappNumber && (
          <span className="text-sm text-muted">
            {displayNumber(buyer.whatsappNumber)}
          </span>
        )}
      </div>
      {buyer.items.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {buyer.items.map((item) => (
            <ItemLine key={item.listingId} item={item} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">
          {seller ? "Nenhum item seu" : "Sem itens"}
        </p>
      )}
    </div>
  );
}

function OwedCell({ buyer }: { buyer: BuyerSummary }) {
  return (
    <div className="whitespace-nowrap">
      <p className="font-semibold tabular-nums">
        {formatMoney(buyer.owedCents)}
      </p>
      {buyer.unpricedCount > 0 && (
        <p className="mt-0.5 text-xs text-muted">
          {buyer.unpricedCount} sem preço
        </p>
      )}
    </div>
  );
}

// Cells render as components, so the columns live at module level. Rows come
// in ordered by name, and the table's sort is stable, so equal amounts keep
// that order whichever way the amounts are sorted.
const columns: DataTableColumns<BuyerRow> = [
  {
    id: "name",
    header: "Comprador",
    accessorFn: (row) => row.buyer.name,
    sortFn: (a, b) => compareText(a.original.buyer.name, b.original.buyer.name),
    cell: ({ row: { original } }) => (
      <BuyerCell buyer={original.buyer} seller={original.seller} />
    ),
  },
  {
    id: "owed",
    header: "A receber",
    accessorFn: (row) => row.buyer.owedCents,
    sortFn: (a, b) => a.original.buyer.owedCents - b.original.buyer.owedCents,
    cell: ({ row }) => <OwedCell buyer={row.original.buyer} />,
  },
  {
    id: "acoes",
    header: () => <span className="sr-only">Ações</span>,
    enableSorting: false,
    cell: ({ row: { original } }) => (
      <BuyerActions
        storeId={original.storeId}
        buyer={original.buyer}
        onGone={focusHeading}
      />
    ),
  },
];

/**
 * The Compradores page body: each buyer with their items and what they owe,
 * read from the cache the page seeds so edits, merges and sales show up. The
 * total covers the buyers the search leaves in.
 */
export function BuyersView({
  storeId,
  seller,
}: {
  storeId: string;
  /** A seller sees only the items of their own listings. */
  seller: boolean;
}) {
  const { data } = useSuspenseQuery(readQuery(buyerReads.list(storeId)));
  const [{ query, sort, page }, set] = useTableUrlState(urlState);
  const shown = data.items
    .filter((buyer) => !query || matchesSearch(buyer.name, query))
    .sort((a, b) => compareText(a.name, b.name));
  const total = shown.reduce((sum, buyer) => sum + buyer.owedCents, 0);
  const rows: BuyerRow[] = shown.map((buyer) => ({ buyer, storeId, seller }));
  const table = useDataTable({
    data: rows,
    columns,
    getRowId: (row) => row.buyer.id,
    sort,
    onSortChange: (next) => set({ sort: next }),
    page,
    onPageChange: (next) => set({ page: next }),
  });

  return (
    <section aria-labelledby="buyers-heading">
      <h2 id="buyers-heading" tabIndex={-1} className="sr-only">
        Lista de compradores
      </h2>
      {data.items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-5 py-4 text-sm text-muted">
          Nenhum comprador ainda.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <SearchInput
              id="buyers-search"
              label="Buscar compradores"
              value={query}
              onChange={(value) => set({ query: value })}
              className="w-full sm:w-auto sm:flex-1"
            />
            <p className="rounded-xl border border-line bg-surface px-4 py-2 text-right">
              <span className="block text-xs font-semibold text-muted">
                Total a receber
              </span>
              <span
                className="text-xl font-extrabold tabular-nums"
                data-testid="buyers-total"
              >
                {formatMoney(total)}
              </span>
            </p>
          </div>
          <DataTable
            table={table}
            className={columnWidths}
            empty={
              <p className="px-4 py-8 text-center text-ink-soft">{`Nenhum comprador com "${query}".`}</p>
            }
          />
        </>
      )}
    </section>
  );
}
