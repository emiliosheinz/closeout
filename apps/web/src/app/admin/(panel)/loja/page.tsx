import type { Metadata } from "next";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { requireAdmin } from "@/lib/admin/current-store";
import { absoluteUrl, storePath } from "@/lib/site";

export const metadata: Metadata = { title: "Loja" };

export default async function StorePage() {
  const { store } = await requireAdmin();
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
