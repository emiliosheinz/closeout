import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/components/admin/listing-form";
import { listingFormOptions } from "@/entities/listing/index.server";
import { isManager } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";

export const metadata: Metadata = { title: "Novo anúncio" };

export default async function NewListingPage() {
  const { store, role, sellerId } = await requireMember();
  const { categories, sellers } = await listingFormOptions(store.id);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin"
        className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar aos anúncios
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold">Novo anúncio</h1>
      <p className="mt-1 text-ink-soft">
        Só o nome é obrigatório. Ele fica como rascunho até você publicar.
      </p>
      <div className="mt-8">
        {categories.length === 0 ? (
          <p className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp">
            Esta loja ainda não tem categorias. Recrie a loja pelo comando
            admin:create.
          </p>
        ) : (
          <ListingForm
            storeId={store.id}
            categories={categories}
            sellers={sellers}
            ownSellerId={sellerId}
            canAssignSellers={isManager(role)}
          />
        )}
      </div>
    </div>
  );
}
