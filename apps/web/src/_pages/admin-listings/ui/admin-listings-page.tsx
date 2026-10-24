import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findStatusFilter, listingReads } from "@/entities/listing";
import {
  redirectToSessionExpired,
  requireMember,
} from "@/entities/session/index.server";
import { Hydrated, loadRead } from "@/shared/api/index.server";
import { ListingBoard } from "./listing-board";

export const metadata: Metadata = { title: "Anúncios" };

export async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { store } = await requireMember();
  const query = await searchParams;
  const q = (query.q ?? "").trim().slice(0, 100);
  const status = findStatusFilter(query.status);
  const [listings, sellers] = await Promise.all([
    loadRead(listingReads.list(store.id), redirectToSessionExpired),
    loadRead(listingReads.sellers(store.id), redirectToSessionExpired),
  ]);
  if (!listings || !sellers) notFound();

  return (
    <Hydrated>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1
          id="listings-heading"
          tabIndex={-1}
          className="text-3xl font-extrabold outline-none"
        >
          Anúncios
        </h1>
        <Link
          href="/admin/anuncios/novo"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
        >
          <Plus className="size-4" aria-hidden="true" />
          Novo anúncio
        </Link>
      </div>

      <ListingBoard
        key={`${status?.slug}|${q}`}
        storeId={store.id}
        storeSlug={store.slug}
        statusSlug={status?.slug}
        q={q}
      />
    </Hydrated>
  );
}
