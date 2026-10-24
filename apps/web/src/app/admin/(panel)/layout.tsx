import { AdminNav } from "@/components/admin/admin-nav";
import { isManager } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { store, role } = await requireMember();
  return (
    <>
      <AdminNav
        storeName={store.name}
        storeSlug={store.slug}
        managesStore={isManager(role)}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
