import { loadRead } from "@/shared/api/index.server";
import { listingReads } from "./reads";

/** Options every listing form needs, loaded into the request's query cache. */
export async function listingFormOptions(storeId: string) {
  const [categories, sellers] = await Promise.all([
    loadRead(listingReads.categories(storeId)),
    loadRead(listingReads.sellers(storeId)),
  ]);
  return { categories: categories?.items ?? [], sellers: sellers?.items ?? [] };
}
