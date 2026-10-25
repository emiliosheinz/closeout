import { pendingInviteSchema } from "@closeout/contracts/schemas";
import { listOf, type Read } from "@/shared/api";
import { inviteKeys } from "../model/keys";
import type { PendingInvite } from "../model/types";

export const inviteReads = {
  pending: (storeId: string): Read<{ items: PendingInvite[] }> => ({
    queryKey: inviteKeys.pending(storeId),
    path: `/stores/${storeId}/invites`,
    schema: listOf(pendingInviteSchema),
  }),
};
