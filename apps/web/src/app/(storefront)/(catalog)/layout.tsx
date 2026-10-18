import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getStore } from "@/lib/catalog/api";

// Checked above loading.tsx: once its shell streams, the status is fixed at 200.
export default async function CatalogLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await getStore())) notFound();
  return children;
}
