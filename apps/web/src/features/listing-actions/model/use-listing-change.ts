import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buyerKeys } from "@/entities/buyer";
import { type AdminListingSummary, listingKeys } from "@/entities/listing";
import { ApiError, api, successFor } from "@/shared/api";
import {
  applyChange,
  type StatusChange,
  statusMessage,
  statusMutationKey,
} from "./status-change";

/** The save was refused because the buyer or the listing changed under the dialog (409). */
export class StaleSaleError extends Error {}

const isStaleSale = (error: unknown) => error instanceof StaleSaleError;

async function send(storeId: string, change: StatusChange): Promise<void> {
  const path = `/stores/${storeId}/listings/${change.id}/${change.route ?? "status"}`;
  try {
    await api("PATCH", path, change.body);
  } catch (error) {
    if (change.inDialog && error instanceof ApiError && error.status === 409)
      throw new StaleSaleError(error.message);
    throw error;
  }
}

/**
 * The one mutation behind every board edit (status, sale details, paid
 * toggle). All share a key so the list overlay shows each pending patch.
 */
export function useListingChange(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: statusMutationKey(storeId),
    mutationFn: (change: StatusChange) => send(storeId, change),
    onMutate: () =>
      client.cancelQueries({ queryKey: listingKeys.list(storeId) }),
    onSuccess: async (_data, applied) => {
      await client.cancelQueries({ queryKey: listingKeys.list(storeId) });
      client.setQueryData(
        listingKeys.list(storeId),
        (old: { items: AdminListingSummary[] } | undefined) =>
          old && { ...old, items: applyChange(old.items, applied) },
      );
    },
    onSettled: () => {
      // The mutation settling now still counts as running.
      if (client.isMutating({ mutationKey: statusMutationKey(storeId) }) > 1) {
        return;
      }
      client.invalidateQueries({ queryKey: listingKeys.all(storeId) });
      client.invalidateQueries({ queryKey: buyerKeys.all(storeId) });
    },
    meta: {
      success: successFor<StatusChange>(statusMessage),
      handlesError: isStaleSale,
    },
  });
}
