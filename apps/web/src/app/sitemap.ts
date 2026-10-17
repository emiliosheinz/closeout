import type { MetadataRoute } from "next";
import { getListings } from "@/lib/catalog/api";
import { DEFAULT_FILTERS } from "@/lib/catalog/params";
import { absoluteUrl, listingPath } from "@/lib/site";

const SITEMAP_PAGE_SIZE = 100;

// Rendered per request so new listings show up without a rebuild.
export const dynamic = "force-dynamic";

/** The storefront plus every published listing (sold ones keep their page). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
  ];
  for (let page = 1; ; page++) {
    const result = await getListings(
      { ...DEFAULT_FILTERS, availability: "all", page },
      SITEMAP_PAGE_SIZE,
    );
    for (const listing of result.items) {
      entries.push({
        url: absoluteUrl(listingPath(listing.slug)),
        priority: 0.7,
      });
    }
    if (page * SITEMAP_PAGE_SIZE >= result.total) break;
  }
  return entries;
}
