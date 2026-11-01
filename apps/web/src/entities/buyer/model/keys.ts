export const buyerKeys = {
  all: (storeId: string) => ["buyers", storeId] as const,
  list: (storeId: string) => ["buyers", storeId, "list"] as const,
};
