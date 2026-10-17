import { requireEnv } from "../env";
import { storeSlug } from "../site";
import { type CatalogFilters, toApiQuery } from "./params";
import type { ListingDetail, ListingPage, StoreInfo } from "./types";

export const PAGE_SIZE = 24;

async function getPublic<T>(path: string): Promise<T | null> {
  const base = requireEnv("API_BASE_URL").replace(/\/$/, "");
  const response = await fetch(
    `${base}/public/stores/${encodeURIComponent(storeSlug())}${path}`,
    // Admins expect edits to show up on the next page load.
    { cache: "no-store" },
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
  );
  if (!page) throw new Error(`Store ${storeSlug()} not found`);
  return page;
}

export function getListing(slug: string): Promise<ListingDetail | null> {
  return getPublic<ListingDetail>(`/listings/${encodeURIComponent(slug)}`);
}
