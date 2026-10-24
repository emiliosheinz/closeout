import { requireEnv } from "../env";
import { type CatalogFilters, hasActiveFilters, toApiQuery } from "./params";
import type { ListingDetail, ListingPage, StoreInfo } from "./types";

export const PAGE_SIZE = 24;

/** Tag on every cached catalog response; admin writes expire it. */
export const CATALOG_CACHE_TAG = "catalog";
/** Backstop for changes made outside the admin, such as operator scripts. */
const CATALOG_REVALIDATE_SECONDS = 300;

const CACHED: RequestInit = {
  next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
};
// Only the first page of the plain catalog is cached: searches, filters and
// deep pages would let any visitor add cache entries at will. Unknown store
// slugs and items cannot add entries either: Next.js only stores 200
// responses in its data cache, and the API answers those with 404.
const UNCACHED: RequestInit = { cache: "no-store" };

async function getPublic<T>(
  path: string,
  init: RequestInit = CACHED,
): Promise<T | null> {
  const base = requireEnv("API_BASE_URL").replace(/\/$/, "");
  const response = await fetch(`${base}/public/stores${path}`, init);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Catalog request ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

function storeApiPath(slug: string): string {
  return `/${encodeURIComponent(slug)}`;
}

export function getStore(slug: string): Promise<StoreInfo | null> {
  return getPublic<StoreInfo>(storeApiPath(slug));
}

export async function getListings(
  slug: string,
  filters: CatalogFilters,
  pageSize = PAGE_SIZE,
): Promise<ListingPage> {
  const page = await getPublic<ListingPage>(
    `${storeApiPath(slug)}/listings?${toApiQuery(filters, pageSize)}`,
    hasActiveFilters(filters) || filters.page > 1 ? UNCACHED : CACHED,
  );
  if (!page) throw new Error(`Store ${slug} not found`);
  return page;
}

export function getListing(
  slug: string,
  item: string,
): Promise<ListingDetail | null> {
  return getPublic<ListingDetail>(
    `${storeApiPath(slug)}/listings/${encodeURIComponent(item)}`,
  );
}

/** Slugs of every store, for the sitemap. */
export async function getStoreSlugs(): Promise<string[]> {
  const index = await getPublic<{ items: { slug: string }[] }>("", UNCACHED);
  if (!index) throw new Error("Store index not found");
  return index.items.map((store) => store.slug);
}
