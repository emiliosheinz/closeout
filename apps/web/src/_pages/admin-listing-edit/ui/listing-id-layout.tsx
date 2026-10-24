import { notFound } from "next/navigation";
import { isUuid } from "@/shared/api/index.server";

/**
 * Rejects a malformed listing id before the loading state streams: once the
 * loading UI is sent the response status is already 200, so the check lives
 * in a layout above the loading boundary.
 */
export async function ListingIdLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return children;
}
