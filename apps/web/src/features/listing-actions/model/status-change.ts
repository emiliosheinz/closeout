import type { AdminListingSummary } from "@/entities/listing";
import { listingKeys } from "@/entities/listing";
import { AVAILABILITY_LABELS, PUBLICATION_LABELS } from "@/shared/lib/format";

/** The summary fields a board edit can change; applied over the cached row while the save is in flight. */
export type SummaryPatch = Partial<
  Pick<AdminListingSummary, "publication" | "availability" | "sale">
>;

export interface StatusChange {
  id: string;
  title: string;
  patch: SummaryPatch;
  /** The request body; the patch is what the row shows meanwhile. */
  body: Record<string, unknown>;
  /** `sale` edits the sale only; `status` (default) may also change availability or publication. */
  route?: "status" | "sale";
  /** Set when a dialog shows the failure, so a stale-buyer conflict is not toasted too. */
  inDialog?: boolean;
}

/** Reserved for mutations whose variables are a `StatusChange`; the list overlay casts them. */
export const statusMutationKey = (storeId: string) =>
  [...listingKeys.all(storeId), "status"] as const;

export function applyChange(
  items: AdminListingSummary[],
  { id, patch }: StatusChange,
): AdminListingSummary[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function statusMessage({ title, patch }: StatusChange): string {
  if (patch.publication) {
    return `"${title}" agora está ${PUBLICATION_LABELS[patch.publication].toLowerCase()}.`;
  }
  if (patch.availability) {
    const buyer = patch.sale?.buyer.name;
    if (buyer && patch.availability !== "available") {
      return `"${title}" ${AVAILABILITY_LABELS[patch.availability].toLowerCase()} para ${buyer}.`;
    }
    return `"${title}" marcado como ${AVAILABILITY_LABELS[patch.availability].toLowerCase()}.`;
  }
  return `Venda de "${title}" atualizada.`;
}
