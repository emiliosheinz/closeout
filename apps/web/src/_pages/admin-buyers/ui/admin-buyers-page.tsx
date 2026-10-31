import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buyerReads } from "@/entities/buyer";
import { isManager } from "@/entities/session";
import {
  redirectToSessionExpired,
  requireMember,
} from "@/entities/session/index.server";
import { Hydrated, loadRead } from "@/shared/api/index.server";
import { BuyersView } from "./buyers-view";

export const metadata: Metadata = { title: "Compradores" };

export async function BuyersPage() {
  const { store, role } = await requireMember();
  const buyers = await loadRead(
    buyerReads.list(store.id),
    redirectToSessionExpired,
  );
  if (!buyers) notFound();
  const seller = !isManager(role);

  return (
    <Hydrated>
      <h1 className="text-3xl font-extrabold">Compradores</h1>
      <p className="mt-1 max-w-[60ch] text-ink-soft">
        {seller
          ? "Itens e valores dos seus anúncios."
          : "Quem reservou ou comprou, o que cada pessoa ainda deve e como falar com ela."}
      </p>
      <div className="mt-8">
        <BuyersView storeId={store.id} seller={seller} />
      </div>
    </Hydrated>
  );
}
