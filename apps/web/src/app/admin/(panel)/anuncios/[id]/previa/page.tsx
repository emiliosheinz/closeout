import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingView } from "@/components/storefront/listing-view";
import type { ListingDetail } from "@/entities/listing";
import { requireMember } from "@/entities/session/index.server";
import { adminGet, isUuid } from "@/shared/api/index.server";

export const metadata: Metadata = { title: "Pré-visualização" };

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { store } = await requireMember();
  const listing = await adminGet<ListingDetail>(
    `/stores/${store.id}/listings/${id}/preview`,
  );
  if (!listing) notFound();
  return (
    <>
      <p
        role="status"
        className="mb-4 rounded-md bg-sticker/60 px-3 py-2 text-sm font-semibold text-sticker-ink"
      >
        Pré-visualização: é assim que o anúncio vai aparecer depois de
        publicado.
      </p>
      <ListingView storeSlug={store.slug} listing={listing} />
    </>
  );
}
