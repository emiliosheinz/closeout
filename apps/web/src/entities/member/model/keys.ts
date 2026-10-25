export const memberKeys = {
  list: (storeId: string) => ["members", storeId, "list"] as const,
};
