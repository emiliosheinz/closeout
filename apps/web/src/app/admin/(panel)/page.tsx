import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ListingRows } from "@/components/admin/listing-rows";
import { requireAdmin } from "@/lib/admin/current-store";
import { adminGet } from "@/lib/admin/server-api";
import type { AdminListingSummary, DashboardCounts } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Anúncios" };

const COUNTS: { key: keyof DashboardCounts; label: string }[] = [
  { key: "published", label: "Publicados" },
  { key: "available", label: "Disponíveis" },
  { key: "reserved", label: "Reservados" },
  { key: "sold", label: "Vendidos" },
  { key: "draft", label: "Rascunhos" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { store } = await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const [counts, listings] = await Promise.all([
    adminGet<DashboardCounts>(`/stores/${store.id}/dashboard`),
    adminGet<{ items: AdminListingSummary[] }>(
      `/stores/${store.id}/listings${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  ]);

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
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
          {COUNTS.map(({ key, label }) => (
            <div key={key} className="bg-surface px-4 py-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd
                className="mt-1 text-2xl font-extrabold"
                data-testid={`count-${key}`}
              >
                {counts[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <form action="/admin" method="get" className="relative mt-8 max-w-md">
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
        {listings && listings.items.length > 0 ? (
          <ListingRows storeId={store.id} listings={listings.items} />
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-soft">
            {q
              ? `Nenhum anúncio com "${q}" no título.`
              : "Nenhum anúncio ainda. Comece pelo botão Novo anúncio."}
          </p>
        )}
      </div>
    </>
  );
}
