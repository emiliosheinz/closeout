import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getStore } from "@/entities/listing/index.server";

// Checked above loading.tsx: once its shell streams, the status is fixed at 200.
// An unknown store falls through to the site-wide not-found page.
export async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getStore(slug))) notFound();
  return children;
}
