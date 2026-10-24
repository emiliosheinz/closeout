import { adminGet } from "@/shared/api/index.server";
import type { Category, Seller } from "../model/types";

/** Options every listing form needs. */
export async function listingFormOptions(storeId: string) {
  const [categories, sellers] = await Promise.all([
    adminGet<{ items: Category[] }>(`/stores/${storeId}/categories`),
    adminGet<{ items: Seller[] }>(`/stores/${storeId}/sellers`),
  ]);
  return { categories: categories?.items ?? [], sellers: sellers?.items ?? [] };
}
