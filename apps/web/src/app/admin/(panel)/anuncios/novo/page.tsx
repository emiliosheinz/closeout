import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/components/admin/listing-form";
import { requireAdmin } from "@/lib/admin/current-store";
import { listingFormOptions } from "@/lib/admin/form-data";

export const metadata: Metadata = { title: "Novo anúncio" };

export default async function NewListingPage() {
  const { me, store } = await requireAdmin();
  const { categories, sellers } = await listingFormOptions(store.id);
  const mine = sellers.find((seller) => seller.userId === me.user.id);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin"
        className="text-sm font-semibold text-ink-soft hover:text-ink"
      >
        Voltar aos anúncios
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold">Novo anúncio</h1>
      <p className="mt-1 text-ink-soft">
        Só o nome é obrigatório. Ele fica como rascunho até você publicar.
      </p>
      <div className="mt-8">
        {categories.length === 0 ? (
          <p className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp">
            Esta loja ainda não tem categorias. Recrie a loja pelo comando
            admin:create.
          </p>
        ) : sellers.length === 0 ? (
          <p className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp">
            Cadastre um vendedor antes, em{" "}
            <Link href="/admin/vendedores" className="underline">
              Vendedores
            </Link>
            .
          </p>
        ) : (
          <ListingForm
            storeId={store.id}
            categories={categories}
            sellers={sellers}
            defaultSellerId={mine?.id ?? null}
          />
        )}
      </div>
    </div>
  );
}
