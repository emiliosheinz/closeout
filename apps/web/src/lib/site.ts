import { requireEnv } from "./env";

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
