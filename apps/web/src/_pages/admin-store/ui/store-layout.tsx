import { notFound } from "next/navigation";
import { isManager } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";

/**
 * Hides the store settings from sellers before the loading state streams: once
 * the loading UI is sent the response status is already 200, so the check
 * lives in a layout above the loading boundary.
 */
export async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireMember();
  if (!isManager(role)) notFound();
  return children;
}
