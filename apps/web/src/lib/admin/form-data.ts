import { adminGet } from "./server-api";
import type { Category, Seller } from "./types";

/** Options every listing form needs. */
export async function listingFormOptions(storeId: string) {
  const [categories, sellers] = await Promise.all([
    adminGet<{ items: Category[] }>(`/stores/${storeId}/categories`),
    adminGet<{ items: Seller[] }>(`/stores/${storeId}/sellers`),
  ]);
  return { categories: categories?.items ?? [], sellers: sellers?.items ?? [] };
}
