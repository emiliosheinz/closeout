import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminListingDetail } from "@/entities/listing";
import { listingFormOptions } from "@/entities/listing/index.server";
import { isManager } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";
import { ListingForm } from "@/features/listing-form";
import { PhotoManager } from "@/features/manage-photos";
import { adminGet, isUuid } from "@/shared/api/index.server";
import { itemPath } from "@/shared/lib/site";

export const metadata: Metadata = { title: "Editar anúncio" };

const NOTICES: Record<string, string> = {
  "1": "Alterações salvas.",
  publicado: "Anúncio publicado. Já aparece na loja.",
};

export async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; erro?: string; copiado?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const query = await searchParams;
  const { store, role, sellerId } = await requireMember();
  const [listing, options] = await Promise.all([
    adminGet<AdminListingDetail>(`/stores/${store.id}/listings/${id}`),
    listingFormOptions(store.id),
  ]);
  if (!listing) notFound();

  const notice = query.copiado
    ? "Cópia criada como rascunho. Ajuste o que mudou e adicione as fotos."
    : query.salvo
      ? NOTICES[query.salvo]
      : undefined;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin"
        className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar aos anúncios
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{listing.title}</h1>
        <a
          href={
            listing.publication === "published"
              ? itemPath(store.slug, listing.slug)
              : `/admin/anuncios/${listing.id}/previa`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold underline decoration-ink/30 underline-offset-4"
        >
          {listing.publication === "published"
            ? "Ver na loja"
            : "Pré-visualizar"}
        </a>
      </div>
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-md bg-go/10 px-3 py-2 text-sm font-medium text-go"
        >
          {notice}
        </p>
      )}
      {query.erro === "envio" && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-stamp/10 px-3 py-2 text-sm font-medium text-stamp"
        >
          O anúncio foi salvo, mas o envio das fotos ou a publicação falhou.
          Confira as fotos abaixo e tente de novo.
        </p>
      )}
      <div className="mt-8">
        <PhotoManager
          storeId={store.id}
          listingId={listing.id}
          initialImages={listing.images}
        />
      </div>
      <div className="mt-10 border-t border-line pt-8">
        <ListingForm
          key={listing.updatedAt}
          storeId={store.id}
          categories={options.categories}
          sellers={options.sellers}
          ownSellerId={sellerId}
          canAssignSellers={isManager(role)}
          listing={listing}
        />
      </div>
    </div>
  );
}
