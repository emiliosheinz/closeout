export const storeKeys = {
  settings: (storeId: string) => ["store", storeId, "settings"] as const,
};
