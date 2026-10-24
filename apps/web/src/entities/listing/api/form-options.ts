import { categorySchema, sellerSchema } from "@closeout/contracts/schemas";
import { listOf } from "@/shared/api";
import { adminGet } from "@/shared/api/index.server";

/** Options every listing form needs. */
export async function listingFormOptions(storeId: string) {
  const [categories, sellers] = await Promise.all([
    adminGet(`/stores/${storeId}/categories`, listOf(categorySchema)),
    adminGet(`/stores/${storeId}/sellers`, listOf(sellerSchema)),
  ]);
  return { categories: categories?.items ?? [], sellers: sellers?.items ?? [] };
}
