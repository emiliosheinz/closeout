import { loadRead } from "@/shared/api/index.server";
import { listingReads } from "./reads";

/** Options every listing form needs, loaded into the request's query cache. */
export async function listingFormOptions(
  storeId: string,
  onUnauthorized?: () => never,
) {
  const [categories, sellers] = await Promise.all([
    loadRead(listingReads.categories(storeId), onUnauthorized),
    loadRead(listingReads.sellers(storeId), onUnauthorized),
  ]);
  return { categories: categories?.items ?? [], sellers: sellers?.items ?? [] };
}
