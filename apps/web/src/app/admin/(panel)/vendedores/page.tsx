import type { Metadata } from "next";
import { SellerEditor } from "@/components/admin/seller-editor";
import { requireAdmin } from "@/lib/admin/current-store";
import { adminGet } from "@/lib/admin/server-api";
import type { Seller } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Vendedores" };

export default async function SellersPage() {
  const { store } = await requireAdmin();
  const sellers = await adminGet<{ items: Seller[] }>(
    `/stores/${store.id}/sellers`,
  );
  return (
    <>
      <h1 className="text-3xl font-extrabold">Vendedores</h1>
      <p className="mt-1 max-w-[60ch] text-ink-soft">
        Cada anúncio tem alguém responsável. O botão de WhatsApp do item abre a
        conversa com essa pessoa.
      </p>
      <div className="mt-8">
        <SellerEditor storeId={store.id} sellers={sellers?.items ?? []} />
      </div>
    </>
  );
}
