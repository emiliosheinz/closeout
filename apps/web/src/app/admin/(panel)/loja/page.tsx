import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { isManager, requireMember } from "@/lib/admin/current-store";
import { absoluteUrl, storePath } from "@/shared/lib/site";

export const metadata: Metadata = { title: "Loja" };

export default async function StorePage() {
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
