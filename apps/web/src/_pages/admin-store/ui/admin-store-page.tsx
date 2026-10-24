import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isManager } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";
import { storeReads } from "@/entities/store";
import { StoreSettingsForm } from "@/features/edit-store";
import { loadRead } from "@/shared/api/index.server";
import { absoluteUrl, storePath } from "@/shared/lib/site";

export const metadata: Metadata = { title: "Loja" };

export async function StorePage() {
  const { store: current, role } = await requireMember();
  // Also checked here: layouts do not re-run on every client navigation.
  if (!isManager(role)) notFound();
  const store = await loadRead(storeReads.settings(current.id));
  if (!store) notFound();
  return (
    <>
      <h1 className="text-3xl font-extrabold">Loja</h1>
      <p className="mt-1 text-ink-soft">
        O que aparece no topo da página que vocês compartilham.
      </p>
      <div className="mt-8">
        <StoreSettingsForm
          store={store}
          storeUrl={absoluteUrl(storePath(store.slug))}
        />
      </div>
    </>
  );
}
