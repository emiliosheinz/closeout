import type { MetadataRoute } from "next";
import { DEFAULT_FILTERS } from "@/entities/listing";
import { getListings, getStoreSlugs } from "@/entities/listing/index.server";
import { absoluteUrl, itemPath, storePath } from "@/shared/lib/site";

const SITEMAP_PAGE_SIZE = 100;

// Rendered per request so new listings show up without a rebuild.
export const dynamic = "force-dynamic";

/** Every store's catalog plus its published listings (sold ones keep their page). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  for (const slug of await getStoreSlugs()) {
    entries.push({
      url: absoluteUrl(storePath(slug)),
      changeFrequency: "daily",
      priority: 1,
    });
    for (let page = 1; ; page++) {
      const result = await getListings(
        slug,
        { ...DEFAULT_FILTERS, availability: "all", page },
        SITEMAP_PAGE_SIZE,
      );
      for (const listing of result.items) {
        entries.push({
          url: absoluteUrl(itemPath(slug, listing.slug)),
          priority: 0.7,
        });
      }
      if (page * SITEMAP_PAGE_SIZE >= result.total) break;
    }
  }
  return entries;
}
