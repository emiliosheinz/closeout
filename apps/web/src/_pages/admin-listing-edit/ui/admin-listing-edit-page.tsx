import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listingReads } from "@/entities/listing";
import { listingFormOptions } from "@/entities/listing/index.server";
import { isManager } from "@/entities/session";
import {
  redirectToSessionExpired,
  requireMember,
} from "@/entities/session/index.server";
import { ListingForm } from "@/features/listing-form";
import { PhotoManager } from "@/features/manage-photos";
import { Hydrated, isUuid, loadRead } from "@/shared/api/index.server";
import { ListingHeading } from "./listing-heading";
import { ListingNoticeToast } from "./listing-notice-toast";

export const metadata: Metadata = { title: "Editar anúncio" };

export async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Also checked here: layouts do not re-run on every client navigation.
  if (!isUuid(id)) notFound();
  const { store, role, sellerId } = await requireMember();
  const [listing, options] = await Promise.all([
    loadRead(listingReads.detail(store.id, id), redirectToSessionExpired),
    listingFormOptions(store.id, redirectToSessionExpired),
  ]);
  if (!listing) notFound();

  return (
    <Hydrated>
      <div className="max-w-3xl">
        <ListingNoticeToast />
        <Link
          href="/admin"
          className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar aos anúncios
        </Link>
        <ListingHeading
          storeId={store.id}
          storeSlug={store.slug}
          listingId={id}
        />
        <div className="mt-8">
          <PhotoManager storeId={store.id} listingId={id} />
        </div>
        <div className="mt-10 border-t border-line pt-8">
          <ListingForm
            storeId={store.id}
            categories={options.categories}
            sellers={options.sellers}
            ownSellerId={sellerId}
            canAssignSellers={isManager(role)}
            listingId={id}
          />
        </div>
      </div>
    </Hydrated>
  );
}
