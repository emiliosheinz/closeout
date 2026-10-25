export const listingKeys = {
  all: (storeId: string) => ["listings", storeId] as const,
  list: (storeId: string) => ["listings", storeId, "list"] as const,
  detail: (storeId: string, id: string) =>
    ["listings", storeId, "detail", id] as const,
  preview: (storeId: string, id: string) =>
    ["listings", storeId, "preview", id] as const,
  categories: (storeId: string) => ["listings", storeId, "categories"] as const,
  sellers: (storeId: string) => ["listings", storeId, "sellers"] as const,
};
