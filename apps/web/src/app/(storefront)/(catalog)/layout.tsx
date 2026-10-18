import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getStore } from "@/lib/catalog/api";

/**
 * Checks the store above loading.tsx: once that boundary streams its shell
 * the response status is fixed at 200, so a missing store has to be caught
 * here to answer 404.
 */
export default async function CatalogLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await getStore())) notFound();
  return children;
}
