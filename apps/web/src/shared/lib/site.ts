import type { WaitlistPlacement } from "@closeout/contracts/enums";
import { requireEnv } from "@/shared/config/env";

/** Absolute origin visitors use, e.g. `https://desapego.example`. */
export function publicBaseUrl(): string {
  return requireEnv("PUBLIC_BASE_URL").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${publicBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Root of a store's storefront; every storefront URL starts here. */
export function storePath(slug: string): string {
  return `/store/${encodeURIComponent(slug)}`;
}

export function itemPath(slug: string, item: string): string {
  return `${storePath(slug)}/items/${encodeURIComponent(item)}`;
}

/** Waitlist page, tagged with the placement and, when known, the store it came from. */
export function waitlistPath({
  src,
  ref,
}: {
  src: WaitlistPlacement;
  ref?: string;
}): string {
  const params = new URLSearchParams();
  if (ref) params.set("ref", ref);
  params.set("src", src);
  return `/waitlist?${params}`;
}
