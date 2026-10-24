import { teamMemberSchema } from "@closeout/contracts/schemas";
import { listOf, type Read } from "@/shared/api";
import { memberKeys } from "../model/keys";
import type { TeamMember } from "../model/types";

export const memberReads = {
  list: (storeId: string): Read<{ items: TeamMember[] }> => ({
    queryKey: memberKeys.list(storeId),
    path: `/stores/${storeId}/members`,
    schema: listOf(teamMemberSchema),
  }),
};
