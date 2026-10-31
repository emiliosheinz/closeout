import { adminListingSummarySchema } from "@closeout/contracts/schemas";
import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { buyerKeys } from "@/entities/buyer";
import { type AdminListingSummary, listingKeys } from "@/entities/listing";
import {
  ApiError,
  apiParsed,
  type Schema,
  successFor,
  type WriteResult,
} from "@/shared/api";
import {
  applyChange,
  type StatusChange,
  statusMessage,
  statusMutationKey,
} from "./status-change";

/** The save was refused because the buyer or the listing changed under the dialog (409). */
export class StaleSaleError extends Error {}

const isStaleSale = (error: unknown) => error instanceof StaleSaleError;

const saleOnly = adminListingSummarySchema.pick({ sale: true });

/** The sale the server saved, when the answer carries one; the write itself succeeded either way. */
const savedSale: Schema<{ sale?: AdminListingSummary["sale"] }> = {
  safeParse(data) {
    const result = saleOnly.safeParse(data);
    return { success: true, data: result.success ? result.data : {} };
  },
};

async function send(
  storeId: string,
  change: StatusChange,
): Promise<WriteResult<{ sale?: AdminListingSummary["sale"] }>> {
  const path = `/stores/${storeId}/listings/${change.id}/${change.route ?? "status"}`;
  try {
    return await apiParsed("PATCH", path, change.body, savedSale);
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
    onSuccess: async (result, change) => {
      // The server's sale carries the real buyer id of a buyer just created.
      const applied =
        result.parsed && change.patch.sale && result.data.sale
          ? { ...change, patch: { ...change.patch, sale: result.data.sale } }
          : change;
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

/** Whether a board change for this listing is still in flight, from any component. */
export function useIsListingChanging(storeId: string, id: string): boolean {
  return useMutationState({
    filters: { mutationKey: statusMutationKey(storeId), status: "pending" },
    select: (mutation) => (mutation.state.variables as StatusChange).id,
  }).includes(id);
}
