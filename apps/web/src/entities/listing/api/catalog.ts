import {
  publicListingDetailSchema,
  publicListingPageSchema,
  publicListingSummarySchema,
  publicStoreIndexSchema,
  publicStoreSchema,
} from "@closeout/contracts/schemas";
import { dropInvalid, itemsEnvelope, type Schema } from "@/shared/api";
import { requireEnv } from "@/shared/config/env";
import {
  type CatalogFilters,
  hasActiveFilters,
  toApiQuery,
} from "../model/filters";
import type { ListingDetail, ListingPage, StoreInfo } from "../model/types";

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
  schema: Schema<T>,
  init: RequestInit = CACHED,
): Promise<T | null> {
  const base = requireEnv("API_BASE_URL").replace(/\/$/, "");
  const response = await fetch(`${base}/public/stores${path}`, init);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Catalog request ${path} failed with ${response.status}`);
  }
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    console.error(`Catalog response ${path} failed its schema`, result.error);
    throw new Error(`Catalog response ${path} failed its schema`);
  }
  return result.data;
}

function storeApiPath(slug: string): string {
  return `/${encodeURIComponent(slug)}`;
}

export function getStore(slug: string): Promise<StoreInfo | null> {
  return getPublic(storeApiPath(slug), publicStoreSchema);
}

export async function getListings(
  slug: string,
  filters: CatalogFilters,
  pageSize = PAGE_SIZE,
): Promise<ListingPage> {
  const path = `${storeApiPath(slug)}/listings?${toApiQuery(filters, pageSize)}`;
  const page = await getPublic(
    path,
    publicListingPageSchema,
    hasActiveFilters(filters) || filters.page > 1 ? UNCACHED : CACHED,
  );
  if (!page) throw new Error(`Store ${slug} not found`);
  return {
    ...page,
    items: dropInvalid(page.items, publicListingSummarySchema, path),
    received: page.items.length,
  };
}

export function getListing(
  slug: string,
  item: string,
): Promise<ListingDetail | null> {
  return getPublic(
    `${storeApiPath(slug)}/listings/${encodeURIComponent(item)}`,
    publicListingDetailSchema,
  );
}

/** Slugs of every store, for the sitemap. */
export async function getStoreSlugs(): Promise<string[]> {
  const index = await getPublic("", itemsEnvelope, UNCACHED);
  if (!index) throw new Error("Store index not found");
  return dropInvalid(
    index.items,
    publicStoreIndexSchema.shape.items.element,
    "the store index",
  ).map((store) => store.slug);
}
