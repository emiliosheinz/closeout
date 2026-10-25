export const inviteKeys = {
  pending: (storeId: string) => ["invites", storeId, "pending"] as const,
};
