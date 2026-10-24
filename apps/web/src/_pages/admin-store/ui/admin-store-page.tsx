import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isManager } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";
import { StoreSettingsForm } from "@/features/edit-store";
import { absoluteUrl, storePath } from "@/shared/lib/site";

export const metadata: Metadata = { title: "Loja" };

export async function StorePage() {
  const { store, role } = await requireMember();
  if (!isManager(role)) notFound();
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
