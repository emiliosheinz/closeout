import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ListingRows } from "@/components/admin/listing-rows";
import { requireMember } from "@/lib/admin/current-store";
import { adminGet } from "@/lib/admin/server-api";
import {
  dashboardHref,
  findStatusFilter,
  STATUS_FILTERS,
} from "@/lib/admin/status-filter";
import type {
  AdminListingSummary,
  DashboardCounts,
  Seller,
} from "@/lib/admin/types";
import { cn } from "@/shared/lib/utils";

export const metadata: Metadata = { title: "Anúncios" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { store } = await requireMember();
  const query = await searchParams;
  const q = (query.q ?? "").trim().slice(0, 100);
  const status = findStatusFilter(query.status);
  const [counts, listings, sellers] = await Promise.all([
    adminGet<DashboardCounts>(`/stores/${store.id}/dashboard`),
    adminGet<{ items: AdminListingSummary[] }>(
      `/stores/${store.id}/listings${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
    adminGet<{ items: Seller[] }>(`/stores/${store.id}/sellers`),
  ]);
  const shown = (listings?.items ?? []).filter(
    (listing) => !status || status.matches(listing),
  );
  const unreachableSellerIds = (sellers?.items ?? [])
    .filter((seller) => !seller.whatsappNumber)
    .map((seller) => seller.id);
  const tab = (active: boolean) =>
    cn(
      "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
      active
        ? "bg-ink text-surface"
        : "border border-line bg-surface text-ink-soft hover:border-ink/40",
    );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Anúncios</h1>
        <Link
          href="/admin/anuncios/novo"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
        >
          <Plus className="size-4" aria-hidden="true" />
          Novo anúncio
        </Link>
      </div>

      {counts && (
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
                  {counts.published + counts.draft + counts.archived}
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
      )}

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
            storeId={store.id}
            storeSlug={store.slug}
            listings={shown}
            unreachableSellerIds={unreachableSellerIds}
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
