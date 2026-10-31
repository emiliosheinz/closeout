import { buyerSummarySchema } from "@closeout/contracts/schemas";
import { listOf, type Read } from "@/shared/api";
import { buyerKeys } from "../model/keys";
import type { BuyerSummary } from "../model/types";

export const buyerReads = {
  list: (storeId: string): Read<{ items: BuyerSummary[] }> => ({
    queryKey: buyerKeys.list(storeId),
    path: `/stores/${storeId}/buyers`,
    schema: listOf(buyerSummarySchema),
  }),
};
