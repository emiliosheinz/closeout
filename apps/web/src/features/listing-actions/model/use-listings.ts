import { useMutationState, useSuspenseQuery } from "@tanstack/react-query";
import { listingReads } from "@/entities/listing";
import { readQuery } from "@/shared/api";
import {
  applyChange,
  type StatusChange,
  statusMutationKey,
} from "./status-change";

/**
 * The store's listings from the cache with every status change still in
 * flight applied on top. A refetch landing mid-change cannot undo the new
 * value, and a failed change simply stops being applied.
 */
export function useListings(storeId: string) {
  const { data } = useSuspenseQuery(readQuery(listingReads.list(storeId)));
  const pending = useMutationState({
    filters: { mutationKey: statusMutationKey(storeId), status: "pending" },
    select: (mutation) => mutation.state.variables as StatusChange,
  });
  return pending.reduce(applyChange, data.items);
}
