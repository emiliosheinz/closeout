import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/admin/current-store";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { store } = await requireAdmin();
  return (
    <>
      <AdminNav storeName={store.name} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
