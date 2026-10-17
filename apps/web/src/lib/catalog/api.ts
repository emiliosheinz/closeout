import { requireEnv } from "../env";
import { storeSlug } from "../site";
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
// deep pages would let any visitor add cache entries at will.
const UNCACHED: RequestInit = { cache: "no-store" };

async function getPublic<T>(
  path: string,
  init: RequestInit = CACHED,
): Promise<T | null> {
  const base = requireEnv("API_BASE_URL").replace(/\/$/, "");
  const response = await fetch(
    `${base}/public/stores/${encodeURIComponent(storeSlug())}${path}`,
    init,
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Catalog request ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getStore(): Promise<StoreInfo | null> {
  return getPublic<StoreInfo>("");
}

export async function getListings(
  filters: CatalogFilters,
  pageSize = PAGE_SIZE,
): Promise<ListingPage> {
  const page = await getPublic<ListingPage>(
    `/listings?${toApiQuery(filters, pageSize)}`,
    hasActiveFilters(filters) || filters.page > 1 ? UNCACHED : CACHED,
  );
  if (!page) throw new Error(`Store ${storeSlug()} not found`);
  return page;
}

export function getListing(slug: string): Promise<ListingDetail | null> {
  return getPublic<ListingDetail>(`/listings/${encodeURIComponent(slug)}`);
}
