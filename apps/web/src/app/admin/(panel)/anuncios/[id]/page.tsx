import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/admin/listing-form";
import { PhotoManager } from "@/components/admin/photo-manager";
import { requireAdmin } from "@/lib/admin/current-store";
import { listingFormOptions } from "@/lib/admin/form-data";
import { adminGet } from "@/lib/admin/server-api";
import type { AdminListingDetail } from "@/lib/admin/types";
import { listingPath } from "@/lib/site";

export const metadata: Metadata = { title: "Editar anúncio" };

const NOTICES: Record<string, string> = {
  "1": "Alterações salvas.",
  publicado: "Anúncio publicado. Já aparece na loja.",
};

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; erro?: string; copiado?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { store } = await requireAdmin();
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
        className="text-sm font-semibold text-ink-soft hover:text-ink"
      >
        Voltar aos anúncios
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{listing.title}</h1>
        <a
          href={
            listing.publication === "published"
              ? listingPath(listing.slug)
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
      {query.erro && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-stamp/10 px-3 py-2 text-sm font-medium text-stamp"
        >
          O anúncio foi salvo, mas algo falhou depois: {query.erro}
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
          defaultSellerId={listing.seller.id}
          listing={listing}
        />
      </div>
    </div>
  );
}
