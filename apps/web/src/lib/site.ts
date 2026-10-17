import { requireEnv } from "./env";

/** Absolute origin visitors use, e.g. `https://desapego.example`. */
export function publicBaseUrl(): string {
  return requireEnv("PUBLIC_BASE_URL").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${publicBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function listingPath(slug: string): string {
  return `/itens/${encodeURIComponent(slug)}`;
}

/** The storefront this deployment serves at its root. */
export function storeSlug(): string {
  return requireEnv("STORE_SLUG");
}
