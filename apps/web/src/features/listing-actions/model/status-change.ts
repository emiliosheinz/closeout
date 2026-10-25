import type { Availability, Publication } from "@closeout/contracts/enums";
import { type AdminListingSummary, listingKeys } from "@/entities/listing";
import { AVAILABILITY_LABELS, PUBLICATION_LABELS } from "@/shared/lib/format";

export type StatusPatch =
  | { publication: Publication }
  | { availability: Availability };

export interface StatusChange {
  id: string;
  title: string;
  patch: StatusPatch;
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
  if ("publication" in patch) {
    return `"${title}" agora está ${PUBLICATION_LABELS[patch.publication].toLowerCase()}.`;
  }
  return `"${title}" marcado como ${AVAILABILITY_LABELS[patch.availability].toLowerCase()}.`;
}
