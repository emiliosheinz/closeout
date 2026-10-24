"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  dashboardHref,
  findStatusFilter,
  listingReads,
  STATUS_FILTERS,
  tabCounts,
} from "@/entities/listing";
import { ListingRows, useListings } from "@/features/listing-actions";
import { readQuery } from "@/shared/api";
import { cn } from "@/shared/lib/utils";

const tab = (active: boolean) =>
  cn(
    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
    active
      ? "bg-ink text-surface"
      : "border border-line bg-surface text-ink-soft hover:border-ink/40",
  );

/**
 * Status tabs, search and the listing rows, all read from the listings cache
 * so a status change moves the counts at once. Rows whose status changed stay
 * listed under the active tab until the page remounts, which the page does
 * whenever the filter or search changes.
 */
export function ListingBoard({
  storeId,
  storeSlug,
  statusSlug,
  q,
}: {
  storeId: string;
  storeSlug: string;
  statusSlug: string | undefined;
  q: string;
}) {
  const listings = useListings(storeId);
  const { data: sellers } = useSuspenseQuery(
    readQuery(listingReads.sellers(storeId)),
  );
  const [changedIds, setChangedIds] = useState<string[]>([]);
  const status = findStatusFilter(statusSlug);
  const counts = tabCounts(listings);
  const needle = q.toLowerCase();
  const shown = listings.filter(
    (listing) =>
      (!status || status.matches(listing) || changedIds.includes(listing.id)) &&
      listing.title.toLowerCase().includes(needle),
  );
  const unreachableSellerIds = sellers.items
    .filter((seller) => !seller.whatsappNumber)
    .map((seller) => seller.id);

  return (
    <>
      <nav
        aria-label="Filtrar por situação"
        className="-mx-4 mt-4.5 -mb-1.5 overflow-x-auto px-4 py-1.5 scrollbar-none sm:-mx-1.5 sm:px-1.5"
      >
        <ul className="flex gap-2">
          <li>
            <Link
              href={dashboardHref(null, q)}
              className={tab(status === null)}
              aria-current={status === null ? "page" : undefined}
            >
              Todos
              <span
                className={status === null ? "text-surface/70" : "text-muted"}
              >
                {listings.length}
              </span>
            </Link>
          </li>
          {STATUS_FILTERS.map((filter) => {
            const active = status?.slug === filter.slug;
            return (
              <li key={filter.slug}>
                <Link
                  href={dashboardHref(filter.slug, q)}
                  className={tab(active)}
                  aria-current={active ? "page" : undefined}
                >
                  {filter.label}
                  <span
                    className={active ? "text-surface/70" : "text-muted"}
                    data-testid={`count-${filter.count}`}
                  >
                    {counts[filter.count]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/admin" method="get" className="relative mt-6 max-w-md">
        {status && <input type="hidden" name="status" value={status.slug} />}
        <label htmlFor="admin-search" className="sr-only">
          Buscar anúncios pelo título
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id="admin-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar pelo título"
          className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-base"
        />
      </form>

      <div className="mt-4">
        {shown.length > 0 ? (
          <ListingRows
            storeId={storeId}
            storeSlug={storeSlug}
            listings={shown}
            unreachableSellerIds={unreachableSellerIds}
            onStatusChange={(id) =>
              setChangedIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
            }
          />
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-soft">
            {q
              ? `Nenhum anúncio${status ? ` em ${status.label}` : ""} com "${q}" no título.`
              : status
                ? `Nenhum anúncio em ${status.label}.`
                : "Nenhum anúncio ainda. Comece pelo botão Novo anúncio."}
          </p>
        )}
      </div>
    </>
  );
}
