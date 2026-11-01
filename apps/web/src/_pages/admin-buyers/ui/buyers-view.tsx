"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import Link from "next/link";
import { BuyerContact, type BuyerSummary, buyerReads } from "@/entities/buyer";
import { StatusDot } from "@/entities/listing";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

const urlState = createTableUrlState({
  prefix: "buyers-",
  sorts: ["name", "owed"],
  defaultSort: { column: "owed", direction: "desc" },
});

// One column per buyer, plus the actions menu at the end, which takes only its
// button's width. The amount owed is shown in the buyer's cell, on the name's
// line, so it lines up with the item prices; its column only sorts (through
// the sort select), so its cells are hidden and the headers are left to
// screen readers. On phones the menu sits
// in the corner. This depends on the order of `columns`.
const layout = cn(
  "[&_thead]:sr-only [&_tr>*:nth-child(2)]:hidden [&_td]:align-top sm:[&_tr>*:last-child]:w-px [&_td:last-child]:py-1.5",
  "max-sm:[&_tr]:relative max-sm:[&_td:first-child]:pr-12 max-sm:[&_td:last-child]:absolute max-sm:[&_td:last-child]:top-1 max-sm:[&_td:last-child]:right-0",
);

const SORTS = {
  owed: {
    label: "Maior valor a receber",
    sort: { column: "owed", direction: "desc" },
  },
  name: { label: "Nome", sort: { column: "name", direction: "asc" } },
} as const;

type BuyerRow = { buyer: BuyerSummary; storeId: string; seller: boolean };

function focusHeading() {
  document.getElementById("buyers-heading")?.focus();
}

// Each item is one line: the title and its status, then the agreed price on
// the right, next to what the buyer owes. A paid price is muted with a check,
// so what is still owed stands out.
function ItemLine({ item }: { item: BuyerSummary["items"][number] }) {
  return (
    <li className="flex items-baseline gap-3 py-1 text-sm">
      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-x-3">
        <Link
          href={`/admin/listings/${item.listingId}`}
          title={item.title}
          className="min-w-0 max-w-full text-ink-soft hover:text-ink hover:underline sm:truncate"
        >
          {item.title}
        </Link>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
          <StatusDot status={item.availability} />
          {AVAILABILITY_LABELS[item.availability]}
        </span>
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 tabular-nums",
          item.paid ? "text-muted" : "text-ink-soft",
        )}
      >
        {item.paid && <Check className="size-3.5 text-go" aria-hidden="true" />}
        {item.agreedPriceCents === null
          ? "Sem preço"
          : formatMoney(item.agreedPriceCents)}
        <span className="sr-only">
          , {item.paid ? PAYMENT_LABELS.paid : PAYMENT_LABELS.unpaid}
        </span>
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
    <div className="min-w-0">
      <div className="flex flex-col gap-x-4 gap-y-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <BuyerContact buyer={buyer} />
        <OwedAmount buyer={buyer} className="sm:text-right" />
      </div>
      {buyer.items.length > 0 ? (
        <ul className="mt-1.5">
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

const unpricedLabel = (count: number) =>
  `${count} ${count === 1 ? "item" : "itens"} sem preço`;

/**
 * What the buyer owes: the amount, plus the unpaid items that have no agreed
 * price yet (owed too, of an unknown amount), or "Quitado" when nothing is.
 */
function OwedAmount({
  buyer,
  className,
}: {
  buyer: BuyerSummary;
  className?: string;
}) {
  const { owedCents, unpricedCount } = buyer;
  if (owedCents === 0 && unpricedCount === 0) {
    return <p className={cn("text-sm text-muted", className)}>Quitado</p>;
  }
  if (owedCents === 0) {
    return (
      <p className={cn("text-sm whitespace-nowrap text-muted", className)}>
        {unpricedLabel(unpricedCount)}
      </p>
    );
  }
  return (
    <div className={cn("whitespace-nowrap", className)}>
      <p className="font-semibold tabular-nums">
        {formatMoney(owedCents)}
        <span className="font-normal text-muted"> a receber</span>
      </p>
      {unpricedCount > 0 && (
        <p className="mt-0.5 text-xs text-muted">
          + {unpricedLabel(unpricedCount)}
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
    cell: () => null,
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
  // Any other order in the URL (an old link) falls back to the default.
  const sortKey: keyof typeof SORTS =
    sort?.column === "name" && sort.direction === "asc" ? "name" : "owed";
  const shown = data.items
    .filter((buyer) => !query || matchesSearch(buyer.name, query))
    .sort((a, b) => compareText(a.name, b.name));
  const total = shown.reduce((sum, buyer) => sum + buyer.owedCents, 0);
  const rows: BuyerRow[] = shown.map((buyer) => ({ buyer, storeId, seller }));
  const table = useDataTable({
    data: rows,
    columns,
    getRowId: (row) => row.buyer.id,
    sort: SORTS[sortKey].sort,
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                id="buyers-search"
                label="Buscar compradores"
                value={query}
                onChange={(value) => set({ query: value })}
                className="w-full sm:w-72"
              />
              <Select
                value={sortKey}
                onValueChange={(key) =>
                  set({ sort: SORTS[key as keyof typeof SORTS].sort })
                }
              >
                {/* A combobox takes no name from its content. */}
                <SelectTrigger
                  aria-label={`Ordenar: ${SORTS[sortKey].label}`}
                  className="h-11 w-full justify-start gap-2 rounded-full border-line bg-surface px-4 text-sm text-ink-soft shadow-none sm:w-auto [&>svg]:ml-auto"
                >
                  <span className="text-muted">Ordenar:</span>
                  <SelectValue className="flex-none" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORTS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="flex items-baseline gap-2 sm:justify-end sm:pr-20">
              <span className="text-sm text-muted">Total a receber</span>
              <span
                className="text-lg font-semibold tabular-nums"
                data-testid="buyers-total"
              >
                {formatMoney(total)}
              </span>
            </p>
          </div>
          <DataTable
            table={table}
            className={layout}
            empty={
              <p className="px-4 py-8 text-center text-ink-soft">{`Nenhum comprador com "${query}".`}</p>
            }
          />
        </>
      )}
    </section>
  );
}
