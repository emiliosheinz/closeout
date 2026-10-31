import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listingReads } from "@/entities/listing";
import {
  redirectToSessionExpired,
  requireMember,
} from "@/entities/session/index.server";
import { Hydrated, loadRead } from "@/shared/api/index.server";
import { ListingBoard } from "./listing-board";

export const metadata: Metadata = { title: "Anúncios" };

export async function DashboardPage() {
  const { store } = await requireMember();
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
          href="/admin/listings/new"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
        >
          <Plus className="size-4" aria-hidden="true" />
          Novo anúncio
        </Link>
      </div>

      <ListingBoard storeId={store.id} storeSlug={store.slug} />
    </Hydrated>
  );
}
