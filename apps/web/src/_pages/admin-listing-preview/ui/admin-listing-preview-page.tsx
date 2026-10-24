import { publicListingDetailSchema } from "@closeout/contracts/schemas";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMember } from "@/entities/session/index.server";
import { adminGet, isUuid } from "@/shared/api/index.server";
import { ListingView } from "@/widgets/listing-view";

export const metadata: Metadata = { title: "Pré-visualização" };

export async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { store } = await requireMember();
  const listing = await adminGet(
    `/stores/${store.id}/listings/${id}/preview`,
    publicListingDetailSchema,
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
